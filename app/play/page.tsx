"use client";

import { useApi } from "@/hooks/useApi";
import { Button, Card, Form, Input, message, Select } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const createSessionDescription = `Host your own movie matching session and invite all your friends to join in on the fun! 

Take control as the host and guide everyone through an exciting collection of movie choices. Watch as everyone swipes through films together, and discover which movies your group loves the most. Create unforgettable movie nights by finding the perfect film that everyone wants to watch!`;


const joinSessionDescription = `Got a session code from a friend? Jump right in and join the excitement! 

Enter the unique session code below and start swiping through movies with your group. Share your movie preferences, see what everyone else thinks, and help your friends discover the perfect film for your next movie night together. The more people join, the better the recommendations!`;

interface CreateSessionFormValues {
  sessionName: string;
  maxPlayers: number;
}

interface CreateSessionPayload extends CreateSessionFormValues {
  hostId: number;
}

interface JoinSessionFormValues {
  sessionCode: string;
}

interface SessionResponse {
  sessionCode: string;
  sessionToken: string;
  hostId: number;
}

interface SessionPutDTO {
  id: number;
  token: string;
}

interface JoinSessionResponse {
  sessionCode: string;
  sessionId: number;
  sessionToken: string;
  hostId: number;
}

// Generate player options for the Select component
const playerOptions = Array.from({ length: 16 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1}`,
}));

//implement actual functionality for creating and joining sessions
//usestate -> setsession name
const Play: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();
  const apiService = useApi();
  const [loading, setLoading] = useState(false);
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

  }, [router]);

  const handleCreateSession = async (values: CreateSessionFormValues) => {
    if (loading) return;

    const userId = localStorage.getItem("userId");
    if (!userId) {
      messageApi.error("User ID not found. Please log in again.");
      return;
    }

    try {
      setLoading(true);
      
      // Add hostId from localStorage to the values
      const payload: CreateSessionPayload = {
        ...values,
        hostId: Number(userId),
      };

      const session = await apiService.post<SessionResponse>("/session", payload);

      const {sessionCode, hostId } = session;

      if (!sessionCode) {
        messageApi.error("Failed to create session. Please try again.");
        return;
      }

      // Keep sessionId for frontend logic.
      //localStorage.setItem("sessionId", sessionId.toString());

      //keep code for ev. joining?
      localStorage.setItem("sessionCode", sessionCode);

      localStorage.setItem("hostId", hostId.toString());

      router.push(`/session/${sessionCode}`);
    } catch (error) {
      console.error("Create session error:", error);
      messageApi.error("Failed to create session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async (values: JoinSessionFormValues) => {
  const trimmedCode = values.sessionCode.trim();
  if (!trimmedCode) {
    messageApi.error("Please enter a session code.");
    return;
  }

  const token = parseStorageValue<string>(localStorage.getItem("token"));
  const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
  const userId = Number(userIdRaw);

  if (!token || Number.isNaN(userId)) {
    sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
    router.replace("/login");
    return;
  }

  const payload: SessionPutDTO = {
    id: userId,
    token,
  };

  try {
    const session = await apiService.put<JoinSessionResponse>(`/session/${trimmedCode}`, payload);

    // Optional local hint only (not global), implement in backend for full functionality
    const key = `joinedUsers:${session.sessionCode}`;
    const current = Number(sessionStorage.getItem(key) ?? "1");
    sessionStorage.setItem(key, String(current + 1));

    messageApi.success("Session joined successfully!");
    router.push(`/session/${session.sessionCode}`);
  } catch (error) {
    console.error("Join session error:", error);
    messageApi.error("Failed to join session. Please check the code and try again.");
  }
};

  const parseStorageValue = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
};

  if (!isAuthorized) {
    return null;
  }

  return (
    <>{contextHolder}
    <div className="play-container">
      <Card className="play-card" title="Create New Session">
        <p className="play-description">{createSessionDescription}</p>

        <Form<CreateSessionFormValues>
          layout="vertical"
          onFinish={handleCreateSession}
        >
          <Form.Item
            style={{ marginTop: 24 }}
            name="sessionName"
            label="Session Name"
            rules={[{ required: true, message: "Please input a session name!" }]}
          >
            <Input placeholder="Enter a Session name" />
          </Form.Item>

          <Form.Item
            name="maxPlayers"
            label="Number of Players"
            rules={[{ required: true, message: "Please input the number of players!" }]}
          >

            <Select
              placeholder={
                <span style={{ color: "var(--accent)", opacity: 1 }}>
                  Select the number of players...
                </span>
              }
              options={playerOptions}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" className="play-button">
              Create Session
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card className="play-card" title="Join Session">
        <p className="play-description">{joinSessionDescription}</p>

        <Form<JoinSessionFormValues> layout="vertical" onFinish={handleJoinSession}>
          <Form.Item
            style={{ marginTop: 24 }}
            name="sessionCode"
            label="Session Code"
            rules={[{ required: true, message: "Please input the session code!" }]}
          >
            <Input placeholder="Enter Session Code" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" className="play-button">
              Join Session
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
    </>
  );
};

export default Play;
