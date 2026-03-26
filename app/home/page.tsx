"use client";

import Navbar from "@/components/Navbar";
import { Card, Typography } from "antd";
import { useRouter } from "next/navigation";

const { Title, Paragraph } = Typography;

const homeDescription =
  "The ultimate movie decision app for friends. Swipe through movies together like Tinder and share your preferences to find the perfect film for your next movie night. No more endless debates – just swipe, match, and watch!";

const Home: React.FC = () => {
  const router = useRouter();

  return (
    <div className="page-with-nav">
        <Navbar />

        <div className="home-container">
        <div className="home-intro">
            <Title level={1}>Welcome to UWatch!</Title>
            <Paragraph>{homeDescription}</Paragraph>
        </div>

        <div className="home-actions">
            <Card hoverable className="home-action-card" onClick={() => router.push("/history")}>
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
    );
};

export default Home;