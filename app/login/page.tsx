"use client"; // For components that need React hooks and browser APIs, SSR (server side rendering) has to be disabled. Read more here: https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering

import { useApi } from "@/hooks/useApi";
import useLocalStorage from "@/hooks/useLocalStorage";
import { User } from "@/types/user";
import { Alert, Button, Card, Form, Input } from "antd";
import { useRouter } from "next/navigation"; // use NextJS router for navigation
import { useEffect, useState } from "react";
// Optionally, you can import a CSS module or file for additional styling:
// import styles from "@/styles/page.module.css";

interface FormFieldProps {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const router = useRouter();
  const apiService = useApi();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { set: setToken } = useLocalStorage<string>("token", "");
  const { set: setUserId } = useLocalStorage<string>("userId", "");

  useEffect(() => {
    const redirectMessage = sessionStorage.getItem("redirectMessage");
    if (redirectMessage) {
      setInfoMessage(redirectMessage);
      sessionStorage.removeItem("redirectMessage"); 
    }
  }, []);

  const handleLogin = async (values: FormFieldProps) => {
    try {
      setLoading(true);
      setInfoMessage(null);
      form.setFields([
        { name: "username", errors: [] },
        { name: "password", errors: [] },
      ]);
      // Call the API service and let it handle JSON serialization and error handling
      const response = await apiService.post<User>("/login", values);

      // Use the useLocalStorage hook that returned a setter function (setToken in line 41) to store the token if available
      if (response.token && response.id) {
        setToken(response.token);
        setUserId(response.id);
      }

      router.push("/home");
    } catch (error) {
      const err = error as {status?: number; message?: string};
      if (err.status === 401) {
        err.message = "Invalid username or password.";
      } else {
        err.message = "An error occurred during login. Please try again.";
      }
      form.setFields([{ name: "username", errors: [err.message] }]);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestRegister = async () => {
    if (loading) return;

    try {
      setLoading(true);

      const response = await apiService.post<User>("/register", null);

      if (response.token && response.id) {
        setToken(response.token);
        setUserId(response.id);
      }

      router.push("/home");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("An unknown error occurred during registration.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card" 
        title="Login" 
        >
        {infoMessage && (
          <Alert
            title={infoMessage}
            type="info"
            showIcon
            closable={{closeIcon: true, onClose: () => setInfoMessage(null)}}
            style={{ marginBottom: 16, backgroundColor: "#4da3ee"}}
          />
        )}
        <Form
          form={form}
          name="login"
          size="large"
          variant="outlined"
          onFinish={handleLogin}
          layout="vertical"
          >
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: "Please input your username!" }]}
          >
            <Input placeholder="Enter username" disabled={loading}/>
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Please input your password!" }]}
          >
            <Input.Password placeholder="Enter password" autoComplete="off" disabled={loading}/>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" className="login-button" loading={loading} disabled={loading}>
              Login
            </Button>
          </Form.Item>
          <Form.Item>
            <Button type="primary" className="login-button" loading={loading} onClick={handleGuestRegister}>
              Register as Guest
            </Button>
          </Form.Item>
          <Form.Item style={{ textAlign: "center" }}>
            <Button type="link" className="redirect-link" onClick={() => router.push("/register")} loading={loading}>
              No account yet? Sign up
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
