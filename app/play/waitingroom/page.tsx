"use client";

import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import { Button, Card, Form, InputNumber, Select, Space, Spin, Tag, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SessionResponse {
  sessionId: number;
  sessionCode: string;
  sessionToken: string;
  hostId: number;
}

//hard-coded for now, no nerves for TMDB integration yet
const genreOptions = [
  "Action",
  "Comedy",
  "Drama",
  "Horror",
  "Sci-Fi",
  "Romance",
  "Thriller",
  "Adventure",
];

const SessionPage: React.FC = () => {
  const apiService = useApi();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [sessionCode, setSessionCode] = useState<string | undefined>(undefined);
  const [joinedUsers, setJoinedUsers] = useState(0);

  useEffect(() => {
    const verifyHostAccess = async () => {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");
      const sessionId = localStorage.getItem("sessionId");

      if (!token || !userId || !sessionId) {
        sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
        router.replace("/login");
        return;
      }
      // make sure that both are numbers
      const parsedUserId = Number(userId);
      const parsedSessionId = Number(sessionId);
      
    /* possible Check if userId and sessionId are valid numbers before making the API call 
      - NaN checks if not a number
      if (Number.isNaN(parsedUserId) || Number.isNaN(parsedSessionId)) {
        setErrorMessage("Invalid user or session id.");
        setIsLoading(false);
        return;
      }
      */

      try {
        const session = await apiService.get<SessionResponse>(`/session/${parsedSessionId}`);
        setSessionCode(session.sessionCode);
        setJoinedUsers(1);
        setIsHost(session.hostId === parsedUserId);
      } catch {
        alert("Failed to verify host session access. Please try again if you are the host.");
        router.replace("/play");
      } finally {
        setIsLoading(false);
      }
    };

    void verifyHostAccess();
  }, [apiService, router]);

  if (isLoading) {
    return (
      <div className="page-with-nav">
        <Navbar />
        <div className="play-container host-loading-wrap">
            //should hopefully spin
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-with-nav">
      <Navbar />
      <div className="play-container">
        {isHost ? (
          <Card className="play-card host-card" title="Host Controls">
            <Form layout="vertical">
              <Typography.Title level={5} className="host-section-title">Session Filters</Typography.Title>

              <Form.Item label="Genre (optional)">
                <Space size={[8, 8]} wrap>
                  {genreOptions.map((genre) => (
                    <Tag key={genre}>{genre}</Tag>
                  ))}
                </Space>
              </Form.Item>

              <Form.Item label="Minimum Rating (optional)" 
               name="minRating">
                <Select
                  placeholder="Any rating"
                  options={[
                    { value: 0, label: "Any rating" },
                    { value: 6, label: "6+" },
                    { value: 7, label: "7+" },
                    { value: 8, label: "8+" },
                  ]}
                />
              </Form.Item>

              <Form.Item label="Release Year (optional)" name="releaseYear">
                <Select
                  placeholder="Any year"
                  options={[
                    { value: "any", label: "Any year" },
                    { value: "2020", label: "2020+" },
                    { value: "2010", label: "2010+" },
                    { value: "2000", label: "2000+" },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="Number of Rounds"
                name="rounds"
                rules={[{ required: true, message: "Number of rounds is required." }]}
              >
                <InputNumber min={1} max={20} style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item
                label="Time per Round"
                name="timePerRound"
                rules={[{ required: true, message: "Time per round is required." }]}
              >
                <Select
                  placeholder="Select round time"
                  options={[
                    { value: 15, label: "15 seconds" },
                    { value: 30, label: "30 seconds" },
                    { value: 45, label: "45 seconds" },
                    { value: 60, label: "60 seconds" },
                  ]}
                />
              </Form.Item>
            </Form>

            <div className="host-session-meta">
              <Typography.Text className="host-meta-line">Session Code: {sessionCode ?? "-"}</Typography.Text>
              <Typography.Text className="host-meta-line">{joinedUsers} people have joined</Typography.Text>
              <Button type="primary" block onClick={() => console.log("Start session")}>
                Start Session
              </Button>
              <Button block onClick={() => console.log("End session")}>
                End Session
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="play-card host-card" title="Waiting Room">
            <Typography.Title level={5} className="host-section-title">Session Filters</Typography.Title>
            <Space size={[8, 8]} wrap className="participant-genre-wrap">
              {["Action", "Comedy", "Sci-Fi"].map((genre) => (
                <Tag key={genre}>{genre}</Tag>
              ))}
            </Space>

            <div className="participant-settings">
              <Typography.Text className="host-meta-line">Minimum Rating: Any rating</Typography.Text>
              <Typography.Text className="host-meta-line">Release Year: Any year</Typography.Text>
              <Typography.Text className="host-meta-line">Number of Rounds: 5</Typography.Text>
              <Typography.Text className="host-meta-line">Time per Round: 30 seconds</Typography.Text>
            </div>

            <div className="host-session-meta">
              <Typography.Text className="host-meta-line">Session Code: {sessionCode ?? "-"}</Typography.Text>
              <Typography.Text className="host-meta-line">{joinedUsers} people have joined</Typography.Text>
              <Typography.Text className="participant-waiting-text">Waiting for host to start the session...</Typography.Text>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SessionPage;
