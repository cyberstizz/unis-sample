import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Layout from './layout'; 
import backimage from './assets/randomrapper.jpeg'; 
import './Earnings.scss';

const Earnings = () => {
  
  const dummyData = Array.from({ length: 30 }, (_, index) => {
    const day = `Day ${30 - index}`; 
    const earnings = Math.floor(Math.random() * 100 + 10); 
    const impressions = Math.floor(Math.random() * 1000 + 500); 
    const clicks = Math.floor(Math.random() * 100 + 20);
    return { day, earnings, impressions, clicks };
  }).reverse(); 

  const [selectedDay, setSelectedDay] = useState(null); 

  
  const handleChartClick = (data) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const point = data.activePayload[0].payload;
      setSelectedDay(point);
    }
  };

  return (
    <Layout backgroundImage={backimage}>
      <div className="earnings-page-container">
        <header className="header">
          <h1>Your Earnings</h1>
        </header>

        <main className="content-wrapper">
          <section className="graph-section">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dummyData} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="day" stroke="$text-silver" />
                <YAxis stroke="$text-silver" />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #C0C0C0' }} />
                <Legend />
                <Line type="monotone" dataKey="earnings" stroke="#163387" activeDot={{ r: 8 }} /> {/* Unis blue */}
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="info-box">
            <h2>Day Details</h2>
            {selectedDay ? (
              <div className="details">
                <p><strong>Day:</strong> {selectedDay.day}</p>
                <p><strong>Earnings:</strong> ${selectedDay.earnings}</p>
                <p><strong>Impressions:</strong> {selectedDay.impressions}</p>
                <p><strong>Clicks:</strong> {selectedDay.clicks}</p>
              </div>
            ) : (
              <p className="no-selection">Click a point on the graph to see details for that day.</p>
            )}
          </section>
        </main>
      </div>
    </Layout>
  );
};

export default Earnings;