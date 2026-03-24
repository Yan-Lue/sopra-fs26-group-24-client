"use client"; // For components that need React hooks and browser APIs, SSR (server side rendering) has to be disabled. Read more here: https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering

import { useRouter } from "next/navigation"; // use NextJS router for navigation
import { useApi } from "@/hooks/useApi";
import useLocalStorage from "@/hooks/useLocalStorage";
import { User } from "@/types/user";
import { Button, Form, Input, Card } from "antd";
import { useState } from "react";
// Optionally, you can import a CSS module or file for additional styling:
// import styles from "@/styles/page.module.css";

interface FormFieldProps {
  label: string;
  value: string;
}

const Register: React.FC = () => {
  const router = useRouter();
  const apiService = useApi();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // useLocalStorage hook example use
  // The hook returns an object with the value and two functions
  // Simply choose what you need from the hook:
  const {
    // value: token, // is commented out because we do not need the token value
    set: setToken, // we need this method to set the value of the token to the one we receive from the POST request to the backend server API
    // clear: clearToken, // is commented out because we do not need to clear the token when logging in
  } = useLocalStorage<string>("token", ""); // note that the key we are selecting is "token" and the default value we are setting is an empty string
  // if you want to pick a different token, i.e "usertoken", the line above would look as follows: } = useLocalStorage<string>("usertoken", "");
  const { set: setUserId } = useLocalStorage<string>("userId", "")

  const handleRegister = async (values: FormFieldProps) => {

    if (loading) return;

    try {
      setLoading(true);

      // Call the API service and let it handle JSON serialization and error handling
      const response = await apiService.post<User>("/register", values);

      // Use the useLocalStorage hook that returned a setter function (setToken in line 41) to store the token if available
      if (response.token && response.id) {
        setToken(response.token);
        setUserId(response.id);
      }


      // Navigate to the user overview
      router.push("/");
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

  const handleGuestRegister = async () => {
    if (loading) return;

    try {
      setLoading(true);

      const response = await apiService.post<User>("/register", null);

      if (response.token && response.id) {
        setToken(response.token);
        setUserId(response.id);
      }

      router.push("/");
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
            label="E-mail"
            rules={[{ required: true, message: "Please input your E-Mail address!" }]}
        >
          <Input placeholder="Enter your e-mail address" disabled={loading} />
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
          <Button type="primary" className="login-button" loading={loading} onClick={handleGuestRegister}>
            Register as Guest
          </Button>
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={() => router.push("/login")} className="login-button" loading={loading}>
            Already have an account? Login
          </Button>
        </Form.Item>
      </Form>
      </Card>
    </div>
  );
};

export default Register;
