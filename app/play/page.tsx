"use client";

import Navbar from "@/components/Navbar";
import { Button, Card, Form, Input, Select } from "antd";

const createSessionDescription = `Create a new game session as a host and invite your friends to join.

As a host, you can manage the game settings and start the game when everyone is ready.
To create a session, enter your credentials and click on the "Create Session" button.`;


const joinSessionDescription = `Join an existing game session using the session code provided by the host.

To join a session, enter the session code below and click on the "Join Session" button.`;

interface CreateSessionFormValues {
  sessionName: string;
  numberOfPlayers: number;
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

  const handleCreateSession = (values: CreateSessionFormValues) => {
    console.log("Create session values:", values);
  };

  const handleJoinSession = (values: JoinSessionFormValues) => {
    console.log("Join session values:", values);
  };

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
            name= "numberOfPlayers"
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
            <Input placeholder="XXX-XXX" />
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
