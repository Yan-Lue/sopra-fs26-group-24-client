"use client";

import { useApi } from "@/hooks/useApi";
import { Button, Card, Form, InputNumber, Select, Space, Spin, Tag, Typography } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

//const { Title, Paragraph } = Typography;

interface SessionPutDTO {
  id: number;
  token: string;
}

interface SessionResponse {
  sessionId: number;
  sessionCode: string;
  sessionToken: string;
  hostId: number;
}

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

const SessionWaitingRoom: React.FC = () => {
  const apiService = useApi();
  const router = useRouter();
  const params = useParams();
  const routeSessionCode = params.sessionCode as string;
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [sessionCode, setSessionCode] = useState<string | undefined>(routeSessionCode);
  const [joinedUsers, setJoinedUsers] = useState(0);

  useEffect(() => {
    const verifySessionAccess = async () => {
      const token = parseStorageValue<string>(localStorage.getItem("token"));
      const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
      const parsedUserId = Number(userIdRaw);

      if (!token || Number.isNaN(parsedUserId) || !routeSessionCode) {
        sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
        router.replace("/login");
        return;
      }

      const payload: SessionPutDTO = {
        id: parsedUserId,
        token,
      };

      try {
        const session = await apiService.put<SessionResponse>(`/session/${routeSessionCode}`, payload);

        setSessionCode(session.sessionCode);
        setIsHost(session.hostId === parsedUserId);
        // Local hint only (not global)
        const key = `joinedUsers:${session.sessionCode}`;
        const hinted = Number(sessionStorage.getItem(key) ?? "1");
        setJoinedUsers(hinted);

        setIsValid(true);
      } catch (error) {
        console.error("Failed to verify session access:", error);
        alert("Failed to verify host session access.");
        router.replace("/play");
      } finally {
        setIsLoading(false);
      }
    };

    void verifySessionAccess();
  }, [apiService, routeSessionCode, router]);

  const handleLeave = () => {
    if (sessionCode) {
      const key = `joinedUsers:${sessionCode}`;
      const current = Number(sessionStorage.getItem(key) ?? "1");
      const next = Math.max(current - 1, 0);

      if (next === 0) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, String(next));
      }
    }
    router.replace("/home");
  };

  const parseStorageValue = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
};

  if (isLoading) {
    return (
      <div className="page-with-nav">
        
        <div className="play-container host-loading-wrap">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!isValid) {
    return null;
  }

  return (
    <div className="page-with-nav">
      <div className="session-layout">
        <Card className="play-card participant-card session-side-card" title="Waiting Room">
            <Form layout="vertical" className="waiting-room-form">
              <Typography.Title level={3} className="host-section-title">Waiting Room</Typography.Title>
              {/* TODO: implement dynamic joined users count and check colors and fonts!! */}
                <Typography.Text className="host-meta-line">Joined Users: {joinedUsers}</Typography.Text>

                <Typography.Text className="host-meta-line">Session Code: {sessionCode}</Typography.Text>
                
                <Typography.Text className="host-meta-line">Waiting for the game to start...</Typography.Text>
              <Button type="primary" onClick={handleLeave} className="leave-session-btn">
                Leave Session
              </Button>
            </Form>
        </Card>
        {isHost ? (
                <Card className="play-card host-card session-main-card" title="Host Controls">
                  <Form layout="vertical">
                    <Typography.Title level={3} className="host-section-title">Session Filters</Typography.Title>
      
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
                  </Form>
      
                  <div className="host-session-meta">
                    <Typography.Text className="host-meta-line">Session Code: {sessionCode ?? "-"}</Typography.Text>
                    <Typography.Text className="host-meta-line">{joinedUsers} people have joined</Typography.Text>
                    <Button type="primary" block onClick={() => console.log("Start session")}>
                      Start Session
                    </Button>
                    {/* TODO: implement end session functionality */}
                    <Button block onClick={() => console.log("End session")}>
                      End Session
                      -- Implement End-functionality
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className="play-card host-card session-main-card" title="Waiting Room">
                  <Typography.Title level={3} className="host-section-title">Session Filters</Typography.Title>
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

export default SessionWaitingRoom;
