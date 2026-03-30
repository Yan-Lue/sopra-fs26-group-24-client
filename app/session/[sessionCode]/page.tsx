"use client";

import Navbar from "@/components/Navbar";
import { Button, Card, Typography } from "antd";
import { useRouter, useParams } from "next/navigation";

const { Title, Paragraph } = Typography;

const SessionWaitingRoom: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const sessionCode = params.sessionCode as string;

  const handleLeave = () => {
    // Redirect to the starting page
    router.push("/home");
  };

  return (
    <div className="page-with-nav">
      <Navbar />

      <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
        <Card>
          <Title level={2}>Waiting Room</Title>
          <Paragraph>Session Code: <strong>{sessionCode}</strong></Paragraph>
          <Paragraph>Waiting for the game to start...</Paragraph>

          <Button type="primary" danger onClick={handleLeave} style={{ marginTop: 16 }}>
            Leave
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default SessionWaitingRoom;
