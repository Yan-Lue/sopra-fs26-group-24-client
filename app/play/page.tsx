"use client";

import { Card, Input, Button, Form } from "antd";

const createSessionDescription = `Create a new game session as a host and invite your friends to join.

As a host, you can manage the game settings and start the game when everyone is ready.
To create a session, enter your credentials and click on the "Create Session" button.`;


const joinSessionDescription = `Join an existing game session using the session code provided by the host.

To join a session, enter the session code below and click on the "Join Session" button.`;

//implement actual functionality for creating and joining sessions
//usestate -> setsession name
const Play: React.FC = () => {
  return (
    <div className="play-container">
      <Card className="play-card" title="Create New Session">
        <p className="play-description">{createSessionDescription}</p>

        <Form.Item
          name="sessionName"
          label="Session Name"
          rules={[{ required: true, message: "Please input a session name!" }]}
        >
        <Input placeholder="Enter a Session name" 
          /> 
        </Form.Item>
        <Form.Item
          name= "numberOfPlayers"
          label="Number of Players"
          rules={[{ required: false, message: "Please input the number of players!" }]}
        >
          <Input type="number" value="16" min="1" max="24" placeholder="Enter the number of players" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" className="play-button">
            Create Session
          </Button>
        </Form.Item>
      </Card>

      <Card className="play-card" title="Join Session">
        <p className="play-description">{joinSessionDescription}</p>
        <Form.Item
          name="sessionCode"
          label="Session Code"
          rules={[{ required: true, message: "Please input the session code!" }]}
        >
          <Input placeholder="Enter the session code" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" className="play-button">
            Join Session
          </Button>
        </Form.Item>
      </Card>
    </div>
  );
};

export default Play;
