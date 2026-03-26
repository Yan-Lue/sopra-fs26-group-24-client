"use client";

import { useApi } from "@/hooks/useApi";
import useLocalStorage from "@/hooks/useLocalStorage";
import { User } from "@/types/user";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Descriptions } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

const Profile: React.FC = () => {
  const router = useRouter();
  const apiService = useApi();
  const [user, setUser] = useState<User | null>(null);
  const { clear: clearToken } = useLocalStorage<string>("token", "");
  const { clear: clearUserId } = useLocalStorage<string>("userId", "");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  // handles side effects, interact with systems outside like API, browser storage etc., runs after render
//   useEffect(() => {
//     const token = localStorage.getItem("token");
//     const userId = localStorage.getItem("userId");

//     // uncomment when implementation is ready
//     // if (!token || !userId || token === "" || userId === "") {
//     //   // sessionStorage as better practice for temporary messages, could also use localStorage
//     //   sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
//     //   router.replace("/login");
//     //   return;
//     // }

//     setIsAuthorized(true);

//     const fetchProfile = async () => {
//       try {
//         const userData = await apiService.get<User>(`/users/${userId}`); // implement GET /users/{id} in the backend
//         setUser(userData);
//       } catch (error) {
//         console.error("Error fetching profile:", error);
//         router.replace("/login");
//       }
//     };

//     fetchProfile();
//   }, [apiService, router]);

  const handleLogout = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem("userId");
      const response = await apiService.get<User>(`/users/${userId}`);
      if (userId) {
        await apiService.put(`/users/${userId}`, { status: response.status });
      }
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setLoading(false);
      clearToken();
      clearUserId();
      router.push("/login");
    }
  };

//   // prevents rendering/flickering when not logged in 
//   if (!isAuthorized) {
//     return null;
//   }

  return (
    <div className="card-container">
      <Card title="My Profile" 
      className="background-container"
      styles={{
          header: {
            textAlign: "center",
            fontSize: 20,
            fontWeight: 600,
          },
          body: {
            padding: "24px 32px",
          },
        }}
        >
        <a
          onClick={() => router.push("/home")}
          className="back-link"
        >
          <ArrowLeftOutlined disabled={loading}/> Back to Home
        </a>
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
              <Descriptions.Item label="Bio:">
                <div style={{ 
                  whiteSpace: "pre-wrap", 
                  wordBreak: "break-word",
                  lineHeight: "1.6",
                  textAlign: "left",
                  maxWidth: "360px",
                }}>
                  {user.bio || "No bio provided"}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Status:" >{user.status}</Descriptions.Item>
            </Descriptions>

            <div style={{ textAlign: "center", marginTop: 24 }}>
              <Button onClick={() => router.push("/password")} loading={loading} disabled={loading}>
                Edit Password
              </Button>
            </div>

            <div style={{ textAlign: "center", marginTop: 24 }}>
              <Button onClick={handleLogout} type="primary" danger loading={loading} disabled={loading}>
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