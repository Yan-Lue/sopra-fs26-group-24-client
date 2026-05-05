"use client";

import { useApi } from "@/hooks/useApi";
import { User } from "@/types/user";
import { ArrowLeftOutlined, UserOutlined, IdcardOutlined } from "@ant-design/icons";
import { Avatar, Button, Card, Input, Spin, Form } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const UserProfile: React.FC = () => {
  const apiService = useApi();
  const router = useRouter();
  const params = useParams();
  const userId = params.id;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      try {
        setLoading(true);
        const userData = await apiService.get<User>(`/users/${userId}`);
        setUser(userData);
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [apiService, userId]);

  const profileInitial = (
    user?.name?.trim()?.charAt(0) ||
    user?.username?.trim()?.charAt(0) ||
    "U"
  ).toUpperCase();

  if (loading) {
    return (
      <div className="profile-container">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-container">
        <Card className="profile-card profile-edit-card">
          <p style={{ color: "var(--text)", textAlign: "center" }}>User not found.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <Card title={user.username} className="profile-card profile-edit-card">
        <Button
          type="link"
          className="redirect-link"
          onClick={() => router.push("/home")}
          icon={<ArrowLeftOutlined />}
          style={{ padding: 0, marginBottom: 16 }}
        >
          Back to Home
        </Button>
        <div className="profile-avatar-wrap">
          <Avatar size={96} className="profile-avatar">
            {profileInitial}
          </Avatar>
        </div>

        <Form layout="vertical" className="profile-fields">
          <Form.Item label="Name">
            <Input
              className="profile-input"
              prefix={<UserOutlined />}
              value={user.name || ""}
              disabled
            />
          </Form.Item>

          <Form.Item label="Username">
            <Input
              className="profile-input"
              prefix={<IdcardOutlined />}
              value={user.username || ""}
              disabled
            />
          </Form.Item>

          {user.bio && (
            <Form.Item label="Bio">
              <Input.TextArea
                className="profile-input profile-textarea"
                value={user.bio}
                disabled
                autoSize={{ minRows: 2, maxRows: 5 }}
              />
            </Form.Item>
          )}
        </Form>
      </Card>
    </div>
  );
};

export default UserProfile;
