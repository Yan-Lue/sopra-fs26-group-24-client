"use client";

import { useApi } from "@/hooks/useApi";
import useLocalStorage from "@/hooks/useLocalStorage";
import { User } from "@/types/user";
import {
  ArrowLeftOutlined,
  CloseOutlined,
  EditOutlined,
  IdcardOutlined,
  LockOutlined,
  LogoutOutlined,
  MailOutlined,
  SaveOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Avatar, Button, Card, Form, Input, message } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ProfileFormState = {
  name: string;
  username: string;
  email: string;
  bio: string;
  oldPassword: string;
  newPassword: string;
};

const Profile: React.FC = () => {
  const router = useRouter();
  const apiService = useApi();
  const [form] = Form.useForm();
  const [user, setUser] = useState<User | null>(null);
  const { clear: clearToken } = useLocalStorage<string>("token", "");
  const { clear: clearUserId } = useLocalStorage<string>("userId", "");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // handles side effects, interact with systems outside like API, browser storage etc., runs after render
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    if (!token || !userId || token === "" || userId === "") {
      // sessionStorage as better practice for temporary messages, could also use localStorage
      sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
      router.replace("/login");
      return;
    }

    setIsAuthorized(true);

    const fetchProfile = async () => {
      try {
        const userData = await apiService.get<User>(`/users/${userId}`);
        setUser(userData);
        form.setFieldsValue({
          name: userData.name || "",
          username: userData.username || "",
          email: userData.email || "",
          bio: userData.bio || "",
          oldPassword: "",
          newPassword: "",
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
        router.replace("/login");
      }
    };

    fetchProfile();
  }, [apiService, router]);

  const handleLogout = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem("userId");
      if (userId) {
        await apiService.put(`/users/${userId}`, { status: "offline" });
      }
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setLoading(false);
      clearToken();
      clearUserId();
      router.replace("/login");
    }
  };

  // adapt this later if we want profile icons etc.
  const profileInitial = (
    user?.name?.trim()?.charAt(0) ||
    user?.username?.trim()?.charAt(0) ||
    "U"
  ).toUpperCase();

  const clearFormErrors = () => {
    form.setFields([
      { name: "name", errors: [] },
      { name: "username", errors: [] },
      { name: "email", errors: [] },
      { name: "bio", errors: [] },
      { name: "oldPassword", errors: [] },
      { name: "newPassword", errors: [] },
    ]);
  }

  const startEdit = () => {
    if (!user) return;
    form.setFieldsValue({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      bio: user.bio || "",
      oldPassword: "",
      newPassword: "",
    });
    clearFormErrors();
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (!user) return;
    form.setFieldsValue({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      bio: user.bio || "",
      oldPassword: "",
      newPassword: "",
    });
    clearFormErrors();
    setIsEditing(false);
  };

  const handleSave = async (values: ProfileFormState) => {
    if (!user) return;

    try {
    setLoading(true);

    const check = {
      name: values.name?.trim(),
      username: values.username?.trim(),
      email: values.email?.trim(),
      bio: values.bio?.trim(),
      oldPassword: values.oldPassword?.trim(),
      newPassword: values.newPassword?.trim(),
    };

    if (!check.name || !check.username || !check.email) {
      form.setFields([
          { name: "name", errors: !check.name ? ["Name cannot be empty."] : [] },
          { name: "username", errors: !check.username ? ["Username cannot be empty."] : [] },
          { name: "email", errors: !check.email ? ["Email cannot be empty."] : [] },
        ]);
        return;
      }

    const updates: Record<string, string> = {};

    if ((check.name ?? "") !== (user.name ?? "")) {
      updates.name = check.name;
    }
    if ((check.username ?? "") !== (user.username ?? "")) {
      updates.username = check.username;
    }
    if ((check.email ?? "") !== (user.email ?? "")) {
      updates.email = check.email;
    }
    if ((check.bio ?? "") !== (user.bio ?? "")) {
      updates.bio = check.bio;
    }

    const wantsPasswordChange = !!(check.oldPassword || check.newPassword);
    if (wantsPasswordChange) {
      if (!check.oldPassword || !check.newPassword) {
        const bothMsg = "Please provide both old and new password.";
          form.setFields([
            { name: "oldPassword", errors: [bothMsg] },
            { name: "newPassword", errors: [bothMsg] },
          ]);
          return;
        }

        if (check.oldPassword === check.newPassword) {
          form.setFields([
            { name: "newPassword", errors: ["New password must be different from old password."] },
          ]);
          return;
        }

        updates.oldPassword = check.oldPassword;
        updates.newPassword = check.newPassword;
      }

    if (Object.keys(updates).length === 0) {
      messageApi.info("No changes to save.");
      setIsEditing(false);
      return;
    }

      const updatedUser = await apiService.put<User>(`/users/${user.id}`, updates );
      setUser(updatedUser);

      form.setFieldsValue({
        name: updatedUser.name || "",
        username: updatedUser.username || "",
        email: updatedUser.email || "",
        bio: updatedUser.bio || "",
        oldPassword: "",
        newPassword: "",
      });

      setIsEditing(false);
      messageApi.success("Profile updated successfully.");
    } catch (error) {
      const err = error as { message?: string };
      const errMsg = err.message || "";

      if (errMsg.toLowerCase().includes("email")) {
        form.setFields([
          { name: "email", errors: ["Please enter a valid email address."] },
        ]);
        return;
      } else if (errMsg.toLowerCase().includes("new password")) {
        form.setFields([
          { name: "newPassword", errors: ["New password must be different from old password."] },
        ]);
        return
      } else if (errMsg.toLowerCase().includes("old password")) {
        form.setFields([
          { name: "oldPassword", errors: ["Old password is incorrect."] },
        ]);
        return
      } else {
        messageApi.error("Failed to update profile.");
      }

      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  // prevents rendering/flickering when not logged in 
  if (!isAuthorized) {
    return null;
  }

  return (
    <>
      {contextHolder}
      <div className="profile-container">
        <Card title="My Profile" className="profile-card profile-edit-card">
          <Button
            type="link"
            className="redirect-link"
            onClick={() => router.push("/home")}
            disabled={loading}
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

          {user && (
            <Form form={form} layout="vertical" onFinish={handleSave} className="profile-fields">
              <Form.Item name="name" label="Name">
                <Input
                  className="profile-input"
                  prefix={<UserOutlined />}
                  disabled={!isEditing || loading}
                />
              </Form.Item>

              <Form.Item name="username" label="Username">
                <Input
                  className="profile-input"
                  prefix={<IdcardOutlined />}
                  disabled={!isEditing || loading}
                />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: "email", message: "Please enter a valid email format." }]}
              >
                <Input
                  className="profile-input"
                  prefix={<MailOutlined />}
                  disabled={!isEditing || loading}
                />
              </Form.Item>

              <Form.Item name="bio" label="Bio">
                <Input.TextArea
                  className="profile-input profile-textarea"
                  disabled={!isEditing || loading}
                  autoSize={{ minRows: 3, maxRows: 5 }}
                />
              </Form.Item>

              {!isEditing && (
                <Form.Item label="Password">
                  <Input
                    className="profile-input"
                    prefix={<LockOutlined />}
                    placeholder="*************"
                    disabled
                  />
                </Form.Item>
              )}

              {isEditing && (
                <>
                  <Form.Item name="oldPassword" label="Old Password">
                    <Input.Password
                      className="profile-input"
                      prefix={<LockOutlined />}
                      disabled={loading}
                      autoComplete="off"
                    />
                  </Form.Item>
                  <Form.Item name="newPassword" label="New Password">
                    <Input.Password
                      className="profile-input"
                      prefix={<LockOutlined />}
                      disabled={loading}
                      autoComplete="off"
                    />
                  </Form.Item>
                </>
              )}

              <div className="profile-actions">
                {!isEditing && (
                  <>
                    <Button
                      className="edit-button"
                      icon={<EditOutlined />}
                      onClick={startEdit}
                      disabled={loading}
                    >
                      Edit Profile
                    </Button>
                    <Button
                      className="logout-button"
                      icon={<LogoutOutlined />}
                      onClick={handleLogout}
                      loading={loading}
                      disabled={loading}
                    >
                      Logout
                    </Button>
                  </>
                )}

                {isEditing && (
                  <>
                    <Button
                      className="save-button"
                      icon={<SaveOutlined />}
                      htmlType="submit"
                      loading={loading}
                      disabled={loading}
                    >
                      Save
                    </Button>
                    <Button
                      className="cancel-button"
                      icon={<CloseOutlined />}
                      onClick={cancelEdit}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </Form>
          )}
        </Card>
      </div>
    </>
  );
};

export default Profile;