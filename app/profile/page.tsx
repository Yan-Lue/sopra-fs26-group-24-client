"use client";

import { useApi } from "@/hooks/useApi";
import useLocalStorage from "@/hooks/useLocalStorage";
import { User } from "@/types/user";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Avatar, Button, Card, Descriptions } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const Profile: React.FC = () => {
  const router = useRouter();
  const apiService = useApi();
  const [user, setUser] = useState<User | null>(null);
  const { clear: clearToken } = useLocalStorage<string>("token", "");
  const { clear: clearUserId } = useLocalStorage<string>("userId", "");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

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
      // const response = await apiService.get<User>(`/users/${userId}`);
      // IMPLEMENT PUT ENDPOINT FIRST
      // if (userId) {
      //   await apiService.put(`/users/${userId}`, { status: response.status });
      // }
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

  // prevents rendering/flickering when not logged in 
  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="profile-container">
      <Card title="My Profile" 
      className="profile-card"
      >
        <Button type="link" className="redirect-link" onClick={() => router.push("/home")} disabled={loading}
          icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: 16 }} > Back to Home 
        </Button>
        <div className="profile-avatar-wrap">
          <Avatar size={96} className="profile-avatar">
            {profileInitial}
          </Avatar>
        </div>
        {user && (
          <>
            <Descriptions 
                column={1} 
                bordered styles={{
                label: { color: 'white', fontWeight: 'bold' },
                content: { color: 'white' },
              }}>
              <Descriptions.Item label="UserID:" >{user.id}</Descriptions.Item>
              <Descriptions.Item label="Name:" >{user.name}</Descriptions.Item>
              <Descriptions.Item label="Username:" >{user.username}</Descriptions.Item>
              <Descriptions.Item label="Email:" >{user.email}</Descriptions.Item>
              <Descriptions.Item label="Bio:"><div className="profile-bio">{user.bio || "No bio available."}</div></Descriptions.Item>
              <Descriptions.Item label="Status:" >{user.status}</Descriptions.Item>
            </Descriptions>

            <div className="profile-actions">
              <Button onClick={handleLogout} className="logout-button" loading={loading} disabled={loading}>
                Logout
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default Profile;