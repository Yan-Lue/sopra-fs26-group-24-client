"use client"; // For components that need React hooks and browser APIs, SSR (server side rendering) has to be disabled. Read more here: https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering

import { useApi } from "@/hooks/useApi";
import useLocalStorage from "@/hooks/useLocalStorage";
import { User } from "@/types/user";
import { Button, Card, Form, Input } from "antd";
import { useRouter } from "next/navigation"; // use NextJS router for navigation
import { useState } from "react";
// Optionally, you can import a CSS module or file for additional styling:
// import styles from "@/styles/page.module.css";

interface FormFieldProps {
  name: string;
  username: string;
  email: string;
  password: string;
  bio?: string;
}

const Register: React.FC = () => {
  const router = useRouter();
  const apiService = useApi();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { set: setToken } = useLocalStorage<string>("token", "");
  const { set: setUserId } = useLocalStorage<string>("userId", "");

  const handleRegister = async (values: FormFieldProps) => {

    if (loading) return;

    try {
      setLoading(true);
      form.setFields([
        { name: "username", errors: [] },
        { name: "email", errors: [] },
        { name: "password", errors: [] },
        { name: "bio", errors: [] },
        { name: "name", errors: [] },
      ]);

      // Call the API service and let it handle JSON serialization and error handling
      const response = await apiService.post<User>("/register", values);

      // Use the useLocalStorage hook that returned a setter function (setToken in line 41) to store the token if available
      if (response.token && response.id) {
        setToken(response.token);
        setUserId(response.id);
      }


      // Navigate to the user overview
      router.push("/home");
    } catch (error) {
      const err = error as {status?: number; message?: string};
      if (err.message?.includes("Username")) {
        err.message = "Username already taken. Please choose a different one.";
        form.setFields([{ name: "username", errors: [err.message] }]);
      } else if (err.message?.includes("Email")) {
        err.message = "Email already registered. Please use a different email address.";
        form.setFields([{ name: "email", errors: [err.message] }]);
      } else {
        err.message = "An error occurred during registration. Please try again.";
        setErrorMessage(err.message);
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="register-card"
            title="Register"
      >
        <Form
          form={form}
          name="register"
          size="large"
          variant="outlined"
          onFinish={handleRegister}
          layout="vertical"
        >
          { errorMessage && <p className="error-message">{errorMessage}</p> }
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Please input your name!" }]}
          >
            <Input placeholder="Enter your name" disabled={loading} />
          </Form.Item>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: "Please input your username!" }]}
          >
            <Input placeholder="Set your username" disabled={loading} />
          </Form.Item>
          <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, message: "Please input your email address!" }]}
          >
            <Input placeholder="Enter your email address" disabled={loading} />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Please input your password!" }]}
            >
            <Input.Password placeholder="Set your password" disabled={loading} autoComplete = "off" />
          </Form.Item>
          <Form.Item
            name="bio"
            label="Bio"
            rules={[{required: false, message: "Please input your bio!" }]}
            >
            <Input.TextArea placeholder="Tell us about yourself..." maxLength={100} autoSize disabled={loading} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" className="login-button" loading={loading}>
              Register
            </Button>
          </Form.Item>
          <Form.Item>
            <Button type="link" className="redirect-link" onClick={() => router.push("/login")} loading={loading}>
              Already have an account? Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Register;
