from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import boto3
import os
from config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

app = Flask(__name__)
CORS(app)

# AWS Clients
ec2 = boto3.client('ec2', region_name=AWS_REGION,
                   aws_access_key_id=AWS_ACCESS_KEY_ID,
                   aws_secret_access_key=AWS_SECRET_ACCESS_KEY)

s3 = boto3.client('s3', region_name=AWS_REGION,
                  aws_access_key_id=AWS_ACCESS_KEY_ID,
                  aws_secret_access_key=AWS_SECRET_ACCESS_KEY)

# ========== EC2 Routes ==========

@app.route('/ec2/list', methods=['GET'])
def list_instances():
    response = ec2.describe_instances()
    instances = []
    for reservation in response['Reservations']:
        for instance in reservation['Instances']:
            name = 'N/A'
            for tag in instance.get('Tags', []):
                if tag['Key'] == 'Name':
                    name = tag['Value']
                    break
            instances.append({
                'id': instance['InstanceId'],
                'state': instance['State']['Name'],
                'type': instance['InstanceType'],
                'name': name
            })
    return jsonify(instances)

@app.route('/ec2/start/<instance_id>', methods=['POST'])
def start_instance(instance_id):
    ec2.start_instances(InstanceIds=[instance_id])
    return jsonify({'message': f'Started instance {instance_id}'})

@app.route('/ec2/stop/<instance_id>', methods=['POST'])
def stop_instance(instance_id):
    ec2.stop_instances(InstanceIds=[instance_id])
    return jsonify({'message': f'Stopped instance {instance_id}'})

@app.route('/ec2/terminate/<instance_id>', methods=['POST'])
def terminate_instance(instance_id):
    ec2.terminate_instances(InstanceIds=[instance_id])
    return jsonify({'message': f'Terminated instance {instance_id}'})

@app.route('/ec2/create', methods=['POST'])
def create_instance():
    data = request.json
    response = ec2.run_instances(
        ImageId=data.get("ami_id"),
        InstanceType=data.get("instance_type", "t2.micro"),
        KeyName=data.get("key_name", "windows"),
        MinCount=1,
        MaxCount=1
    )
    return jsonify({'message': f'Launched instance {response["Instances"][0]["InstanceId"]}'})

# ========== S3 Routes ==========

@app.route('/s3/list', methods=['GET'])
def list_buckets():
    buckets = s3.list_buckets()
    return jsonify([bucket['Name'] for bucket in buckets['Buckets']])

@app.route('/s3/create', methods=['POST'])
def create_bucket():
    data = request.json
    bucket_name = data.get('bucket_name')
    region = AWS_REGION
    if region == 'us-east-1':
        s3.create_bucket(Bucket=bucket_name)
    else:
        s3.create_bucket(
            Bucket=bucket_name,
            CreateBucketConfiguration={'LocationConstraint': region}
        )
    return jsonify({'message': f'Bucket {bucket_name} created successfully'})

@app.route('/s3/upload', methods=['POST'])
def upload_file():
    bucket_name = request.form['bucket']
    file = request.files['file']
    s3.upload_fileobj(file, bucket_name, file.filename)
    return jsonify({'message': f'File {file.filename} uploaded to {bucket_name}'})

@app.route('/s3/files/<bucket>', methods=['GET'])
def list_files(bucket):
    response = s3.list_objects_v2(Bucket=bucket)
    files = [obj['Key'] for obj in response.get('Contents', [])]
    return jsonify(files)

@app.route('/s3/download/<bucket>/<filename>', methods=['GET'])
def download_file(bucket, filename):
    path = f"temp_{filename}"
    s3.download_file(bucket, filename, path)
    return send_file(path, as_attachment=True)

@app.route('/s3/delete/<bucket>/<filename>', methods=['DELETE'])
def delete_file(bucket, filename):
    s3.delete_object(Bucket=bucket, Key=filename)
    return jsonify({'message': f'Deleted {filename} from {bucket}'})

@app.route('/s3/delete-bucket/<bucket_name>', methods=['DELETE'])
def delete_bucket(bucket_name):
    try:
        # First, delete all objects in the bucket
        objects = s3.list_objects_v2(Bucket=bucket_name)
        if 'Contents' in objects:
            for obj in objects['Contents']:
                s3.delete_object(Bucket=bucket_name, Key=obj['Key'])

        # Now delete the bucket itself
        s3.delete_bucket(Bucket=bucket_name)
        return jsonify({'message': f'Bucket {bucket_name} deleted successfully'})
    except Exception as e:
        return jsonify({'message': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
