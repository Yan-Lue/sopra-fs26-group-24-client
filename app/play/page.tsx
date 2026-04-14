"use client";

import Navbar from "@/components/Navbar";
import { useApi } from "@/hooks/useApi";
import { parseStorageValue } from "@/utils/storage";
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
  joinedUsers?: number; // Optional, for frontend logic
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
  const [createForm] = Form.useForm<CreateSessionFormValues>();
  const [joinForm] = Form.useForm<JoinSessionFormValues>();

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
      createForm.setFields([
        { name: "sessionName", errors: ["Please log in again."] },
      ]);
      return;
    }

    const trimmedSessionName = values.sessionName.trim();
    if (!trimmedSessionName) {
      createForm.setFields([{ name: "sessionName", errors: ["Session name cannot be empty."] }]);
      return;
    }

    try {
      setLoading(true);
      
      // Add hostId from localStorage to the values
      const payload: CreateSessionPayload = {
        ...values,
        sessionName: trimmedSessionName,
        hostId: Number(userId),
      };

      const session = await apiService.post<SessionResponse>("/session", payload);

      const {sessionCode, hostId } = session;

      if (!sessionCode) {
        createForm.setFields([
          { name: "sessionName", errors: ["Failed to create session. Please try again."] },
        ]);
        return;
      }

      // Keep sessionId for frontend logic.
      //localStorage.setItem("sessionId", sessionId.toString());

      //keep code for ev. joining?
      localStorage.setItem("sessionCode", sessionCode);

      localStorage.setItem("hostId", hostId.toString());

      // Mark the creator as already joined so the waiting room does not try to
      // register the host again and hit the session capacity check.
      sessionStorage.setItem(`joinedSession:${sessionCode}`, `${hostId}:${localStorage.getItem("token") ?? ""}`);
      sessionStorage.setItem(`joinedUsers:${sessionCode}`, "1");
      if (session.usernames) {
        sessionStorage.setItem(`joinedUsernames:${sessionCode}`, JSON.stringify(session.usernames));
      }

      router.push(`/session/${sessionCode}`);
    } catch (error) {
      console.error("Create session error:", error);
      createForm.setFields([
        { name: "sessionName", errors: ["Failed to create session. Please try again."] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async (values: JoinSessionFormValues) => {
  const trimmedCode = values.sessionCode.trim();
  if (!trimmedCode) {
    joinForm.setFields([
        { name: "sessionCode", errors: ["Please enter a session code."] },
      ]);
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

  // Navigate to session page; the session page will handle joining if needed
  router.push(`/session/${trimmedCode}`);
};

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="page-with-nav">
      {contextHolder}
      <Navbar />
      <div className="play-container">
        <Card className="play-card" title="Create New Session">
          <p className="play-description">{createSessionDescription}</p>

          <Form<CreateSessionFormValues>
            form={createForm}
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

          <Form<JoinSessionFormValues> form={joinForm} layout="vertical" onFinish={handleJoinSession}>
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
    </div>
  );
};

export default Play;
