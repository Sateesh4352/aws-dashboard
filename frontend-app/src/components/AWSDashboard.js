import React, { useEffect, useState } from 'react';

import './AWSDashboard.css'

const API_BASE = "http://127.0.0.1:5000"; // Flask backend URL

function AWSDashboard() {
  const [instances, setInstances] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [bucketName, setBucketName] = useState("");
  const [selectedBucket, setSelectedBucket] = useState("");
  const [selectedAMI, setSelectedAMI] = useState('ami-03f4878755434977f');
  const [selectedType, setSelectedType] = useState('t2.micro');
  const [keyName, setKeyName] = useState('windows');
  const [instanceName, setInstanceName] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);

  const amiOptions = [
    { id: "ami-03f4878755434977f", name: "Amazon Linux 2 (Mumbai)" },
    { id: "ami-0da59f1af71ea4ad2", name: "Ubuntu 20.04 (Mumbai)" },
    { id: "ami-07caf09b362be10b8", name: "Red Hat 8 (Mumbai)" }
  ];

  const instanceTypes = [
    { type: "t2.micro", name: "T2 Micro" },
    { type: "t2.small", name: "T2 Small" },
    { type: "t3.micro", name: "T3 Micro" },
    { type: "t3a.small", name: "T3a Small" },
    { type: "t4g.micro", name: "T4g Micro" }
  ];

  const fetchInstances = async () => {
    try {
      const res = await fetch(`${API_BASE}/ec2/list`);
      const data = await res.json();
      setInstances(data);
    } catch (err) {
      console.error("Error fetching EC2 instances:", err);
    }
  };

  const fetchBuckets = async () => {
    const res = await fetch(`${API_BASE}/s3/list`);
    const data = await res.json();
    setBuckets(data);
  };

  const fetchFiles = async (bucket) => {
    setSelectedBucket(bucket);
    const res = await fetch(`${API_BASE}/s3/files/${bucket}`);
    const data = await res.json();
    setFiles(data);
  };

  const createBucket = async () => {
    const validName = /^[a-z0-9.-]{3,63}$/;
  
    if (!validName.test(bucketName) || /[A-Z]/.test(bucketName) || bucketName.startsWith('.') || bucketName.endsWith('.') || bucketName.includes('..')) {
      alert("Invalid bucket name! Use only lowercase letters, numbers, hyphens, and it must be globally unique.");
      return;
    }
  
    const res = await fetch(`${API_BASE}/s3/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket_name: bucketName }),
    });
  
    const data = await res.json();
    alert(data.message);
    setBucketName('');
    fetchBuckets();
  };
  

  const uploadToS3 = async () => {
    if (!uploadFile || !selectedBucket) return alert('Choose file and bucket');
    const form = new FormData();
    form.append('file', uploadFile);
    form.append('bucket', selectedBucket);
    const res = await fetch(`${API_BASE}/s3/upload`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    alert(data.message);
    fetchFiles(selectedBucket);
  };

  const deleteFile = async (file) => {
    await fetch(`${API_BASE}/s3/delete/${selectedBucket}/${file}`, {
      method: 'DELETE',
    });
    fetchFiles(selectedBucket);
  };

  const downloadFile = (file) => {
    window.open(`${API_BASE}/s3/download/${selectedBucket}/${file}`);
  };

  const startInstance = async (id) => {
    const res = await fetch(`${API_BASE}/ec2/start/${id}`, { method: "POST" });
    const data = await res.json();
    alert(data.message);
    fetchInstances();
  };

  const stopInstance = async (id) => {
    const res = await fetch(`${API_BASE}/ec2/stop/${id}`, { method: "POST" });
    const data = await res.json();
    alert(data.message);
    fetchInstances();
  };

  const terminateInstance = async (id) => {
    const res = await fetch(`${API_BASE}/ec2/terminate/${id}`, { method: "POST" });
    const data = await res.json();
    alert(data.message);
    fetchInstances();
  };

  const deleteBucket = async (bucket) => {
    if (!window.confirm(`Are you sure you want to delete bucket: ${bucket}? This will delete all files inside it.`)) return;
  
    const res = await fetch(`${API_BASE}/s3/delete-bucket/${bucket}`, {
      method: 'DELETE',
    });
  
    const data = await res.json();
    alert(data.message);
    if (selectedBucket === bucket) {
      setSelectedBucket('');
      setFiles([]);
    }
    fetchBuckets();
  };
  

  const createInstance = async () => {
    const res = await fetch(`${API_BASE}/ec2/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ami_id: selectedAMI,
        instance_type: selectedType,
        key_name: keyName,
        instance_name: instanceName
      })
    });
    const data = await res.json();
    alert(data.message);
    fetchInstances();
  };

  useEffect(() => {
    fetchInstances();
    fetchBuckets();
  }, []);

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">AWS Dashboard</h1>
  
      <section className="card">
        <h2>Launch New EC2 Instance</h2>
  
        <label>Instance Name:</label>
        <input className="input" type="text" value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder="Enter Instance Name" />
  
        <label>AMI:</label>
        <select className="input" value={selectedAMI} onChange={(e) => setSelectedAMI(e.target.value)}>
          {amiOptions.map((ami) => (
            <option key={ami.id} value={ami.id}>{ami.name}</option>
          ))}
        </select>
  
        <label>Instance Type:</label>
        <select className="input" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
          {instanceTypes.map((type) => (
            <option key={type.type} value={type.type}>{type.name}</option>
          ))}
        </select>
  
        <label>Key Name:</label>
        <input className="input" type="text" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g., windows" />
  
        <button className="btn" onClick={createInstance}>Launch</button>
      </section>
  
      <section className="card">
        <h2>EC2 Instances</h2>
        <ul className="list">
          {instances.map((inst) => (
            <li key={inst.id} className="list-item">
              <div>
                <strong>{inst.id}</strong> - {inst.name} - {inst.state} - {inst.type}
              </div>
              <div>
                <button className="btn" onClick={() => startInstance(inst.id)}>Start</button>
                <button className="btn" onClick={() => stopInstance(inst.id)}>Stop</button>
                <button className="btn" onClick={() => terminateInstance(inst.id)}>Terminate</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
  
      <section className="card">
        <h2>Create Bucket</h2>
        <input className="input" value={bucketName} onChange={(e) => setBucketName(e.target.value)} placeholder="Bucket Name" />
        <button className="btn" onClick={createBucket}>Create</button>
  
        <h2>Buckets</h2>
        <ul className="list">
          {buckets.map((bucket) => (
            <li key={bucket} className="list-item">
              {bucket}
              <div>
                <button className="btn" onClick={() => fetchFiles(bucket)}>View Files</button>
                <button className="btn" onClick={() => deleteBucket(bucket)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
  
        {selectedBucket && (
          <div className="file-section">
            <h3>Files in {selectedBucket}</h3>
            <input className="input" type="file" onChange={(e) => setUploadFile(e.target.files[0])} />
            <button className="btn" onClick={uploadToS3}>Upload</button>
            <ul className="list">
              {files.map((file) => (
                <li key={file} className="list-item">
                  {file}
                  <div>
                    <button className="btn" onClick={() => downloadFile(file)}>Download</button>
                    <button className="btn" onClick={() => deleteFile(file)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
  
}

export default AWSDashboard;
