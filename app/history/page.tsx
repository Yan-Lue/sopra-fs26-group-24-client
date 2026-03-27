"use client";

import Navbar from "@/components/Navbar";
import { Card, Typography } from "antd";

const { Title, Paragraph } = Typography;

const historyDescription =
  "Review your previous sessions and dive into the details of your movie nights. See which movies you and your friends enjoyed, check out the session summaries, and relive the fun moments. Your movie history is just a click away!";

const History: React.FC = () => {
  return (
    <div className="page-with-nav">
        <Navbar />

        <div className="history-container">
        <div className="history-intro">
            <Title level={1}>History</Title>
            <Paragraph>{historyDescription}</Paragraph>
        </div>

        <div className="history-actions">
            <Card className="history-action-card">
            Saved items will be displayed here.
            </Card>
        </div>
        </div>
    </div>
  );
};

export default History;