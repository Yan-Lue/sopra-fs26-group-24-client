"use client";

import Navbar from "@/components/Navbar";
import { Card, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const { Title, Paragraph } = Typography;

const historyDescription =
  "Review your previous sessions and dive into the details of your movie nights. See which movies you and your friends enjoyed, check out the session summaries, and relive the fun moments. Your movie history is just a click away!";

const History: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();


  useEffect(() => {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");
  
      if (!token || !userId || token === "" || userId === "") {
        sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
        router.replace("/login");
        return;
      }
  
      setIsAuthorized(true);

  }, [router]);

  if (!isAuthorized) {
    return null;
  }

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