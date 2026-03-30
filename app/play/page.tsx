"use client";

import Navbar from "@/components/Navbar";
import { Button, Card, Form, Input, message, Select } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiDomain } from "@/utils/domain";


const createSessionDescription = `Host your own movie matching session and invite all your friends to join in on the fun! 

Take control as the host and guide everyone through an exciting collection of movie choices. Watch as everyone swipes through films together, and discover which movies your group loves the most. Create unforgettable movie nights by finding the perfect film that everyone wants to watch!`;


const joinSessionDescription = `Got a session code from a friend? Jump right in and join the excitement! 

Enter the unique session code below and start swiping through movies with your group. Share your movie preferences, see what everyone else thinks, and help your friends discover the perfect film for your next movie night together. The more people join, the better the recommendations!`;

interface CreateSessionFormValues {
  sessionName: string;
  numberOfPlayers: number;
}

interface JoinSessionFormValues {
  sessionCode: string;
}

interface JoinSessionFormValues {
  sessionCode: string;
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

  const handleCreateSession = (values: CreateSessionFormValues) => {
    console.log("Create session values:", values);
  };


  const handleJoinSession = async (values: JoinSessionFormValues) => {
    const sessioncode = values.sessionCode.trim();
    console.log("Join session values:", values);

    //check if session code is empty
    if (!sessioncode) {
      message.error("Please enter a session code.");
      return;
    }


    try {
      const apiDomain = getApiDomain();
      const result = await fetch(`${apiDomain}/session/${sessioncode}`, {

        method: "GET",
      });

      if (!result.ok) {
        sessionStorage.setItem("redirectError", "Session not found. Please check the session code and try again.");
        router.push("/home");
        return;
      }

      message.success("Session found! Joining session...");
      router.push(`/session/${sessioncode}`);
    } catch (error) {
      message.error("Server can not be reached. Please try again later.");
    }
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="page-with-nav">
      <Navbar />

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
              name="numberOfPlayers"
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
              <Input placeholder="XXX-XXX" style={{ textAlign: "center" }} />
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
