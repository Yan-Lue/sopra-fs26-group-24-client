"use client";

import Navbar from "@/components/Navbar";
import { Button, Card, Typography } from "antd";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiDomain } from "@/utils/domain";

const { Title, Paragraph } = Typography;

const SessionWaitingRoom: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const sessionCode = params.sessionCode as string;
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateSession = async () => {
      try {
        const apiDomain = getApiDomain();
        const result = await fetch(`${apiDomain}/session/${sessionCode}`, {
          method: "GET",
        });

        if (!result.ok) {
          sessionStorage.setItem("redirectError", "Session not found. Please check the session code and try again.");
          router.replace("/home");
          return;
        }

        setIsValid(true);
      } catch {
        sessionStorage.setItem("redirectError", "Server can not be reached. Please try again later.");
        router.replace("/home");
      }
    };

    validateSession();
  }, [sessionCode, router]);

  const handleLeave = () => {
    router.push("/home");
  };

  if (!isValid) {
    return null;
  }

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
