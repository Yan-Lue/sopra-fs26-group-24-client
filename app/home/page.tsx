"use client";

import Navbar from "@/components/Navbar";
import { Alert, Card, Typography, message } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const { Title, Paragraph } = Typography;

const homeDescription =
  "The ultimate movie decision app for friends. Swipe through movies together like Tinder and share your preferences to find the perfect film for your next movie night. No more endless debates – just swipe, match, and watch!";

const Home: React.FC = () => {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");
  
      if (!token || !userId || token === "" || userId === "") {
        sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
        router.replace("/login");
        return;
      }
  
      setIsAuthorized(true);
  }, []);

  // same as with navbar
  const readStorageString = (key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return "";
    try {
        const parsed = JSON.parse(raw);
        return typeof parsed === "string" ? parsed : String(parsed);
    } catch {
        return raw;
    }
    };

    const handleHistoryCardClick = () => {
    const token = readStorageString("token");
    if (token.startsWith("Guest-")) {
        messageApi.info("Guest users have limited access. Please log in to view history.");
        return;
    }
    router.push("/history");
    };

    // prevents rendering/flickering when not logged in 
  if (!isAuthorized) {
    return null;
  }

  return (
    <>
      {contextHolder}
      <div className="page-with-nav">
        <Navbar />

        <div className="home-container">
        <div className="home-intro">
            <Title level={1}>Welcome to UWatch!</Title>
            <Paragraph>{homeDescription}</Paragraph>
        </div>
        
        {infoMessage && (
          <Alert
            title={infoMessage}
            type="info"
            showIcon
            closable={{closeIcon: true, onClose: () => setInfoMessage(null)}}
            style={{ marginBottom: 16, backgroundColor: "#4da3ee"}}
          />
        )}

        <div className="home-actions">
            <Card hoverable className="home-action-card" onClick={handleHistoryCardClick}>
            <Title>History</Title>
            <Paragraph>See your latest saved results here.</Paragraph>
            </Card>

            <Card hoverable className="home-action-card" onClick={() => router.push("/play")}>
            <Title>Play</Title>
            <Paragraph>Click here to create a new session or to join your friends.</Paragraph>
            </Card>
        </div>
        </div>
    </div>
    </>
    );
};

export default Home;