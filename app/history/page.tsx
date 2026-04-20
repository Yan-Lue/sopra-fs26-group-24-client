"use client";

import Navbar from "@/components/Navbar";
import { useApi } from "@/hooks/useApi";
import { parseStorageValue } from "@/utils/storage";
import { DeleteOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Card, Modal, Typography, message } from "antd";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const { Title, Paragraph, Text } = Typography;

interface HistoryEntry {
  historyId: number;
  sessionName: string;
  sessionCode: string;
  joinedUsers: number;
  creationDate: string;
  movies: { movieId: number; score: number }[];
}

const historyDescription =
  "Review your previous sessions and dive into the details of your movie nights. See which movies you and your friends enjoyed, check out the session summaries, and relive the fun moments. Your movie history is just a click away!";

const History: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [histories, setHistories] = useState<HistoryEntry[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null);
  const router = useRouter();
  const apiService = useApi();
  const [messageApi, contextHolder] = message.useMessage();

  const fetchHistories = useCallback(async () => {
    const userId = parseStorageValue<string | number>(localStorage.getItem("userId"));
    if (!userId) return;
    try {
      const data = await apiService.get<HistoryEntry[]>(`/users/${userId}/histories`);
      setHistories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch histories:", error);
      messageApi.error("Failed to load history.");
    }
  }, [apiService, messageApi]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    if (!token || !userId || token === "" || userId === "") {
      sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
      router.replace("/login");
      return;
    }

    setIsAuthorized(true);
    void fetchHistories();
  }, [router, fetchHistories]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const userId = parseStorageValue<string | number>(localStorage.getItem("userId"));
    try {
      await apiService.delete(`/users/${userId}/histories/${deleteTarget.historyId}`);
      setHistories((prev) => prev.filter((h) => h.historyId !== deleteTarget.historyId));
      messageApi.success("History entry deleted.");
    } catch (error) {
      console.error("Failed to delete history:", error);
      messageApi.error("Failed to delete history entry.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <>
      {contextHolder}
      <div className="page-with-nav">
        <Navbar />

        <div className="history-container">
          <div className="history-intro">
            <Title level={1}>History</Title>
            <Paragraph>{historyDescription}</Paragraph>
          </div>

          <div className="history-list">
            {histories.length === 0 ? (
              <div className="history-empty">
                <Text>No saved sessions yet. Play a session and save it to see it here!</Text>
              </div>
            ) : (
              histories.map((entry) => (
                <Card
                  key={entry.historyId}
                  className="history-entry-card"
                  onClick={() => router.push(`/history/${entry.historyId}`)}
                >
                  <div className="history-entry-content">
                    <div className="history-entry-info">
                      <Title level={4} style={{ marginBottom: 4 }}>
                        {entry.sessionName}
                      </Title>
                      <div className="history-entry-meta">
                        <Text type="secondary">
                          {formatDate(entry.creationDate)} • {entry.joinedUsers} player{entry.joinedUsers !== 1 ? "s" : ""} • {entry.movies.length} movie{entry.movies.length !== 1 ? "s" : ""}
                        </Text>
                      </div>
                    </div>
                    <div className="history-entry-actions">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        className="history-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(entry);
                        }}
                      />
                      <RightOutlined className="history-entry-arrow" />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <Modal
          open={deleteTarget !== null}
          onCancel={() => setDeleteTarget(null)}
          onOk={handleDeleteConfirm}
          title="Delete History Entry"
          okText="Delete"
          okButtonProps={{ danger: true }}
          className="history-delete-modal"
        >
          <Paragraph>
            Are you sure you want to delete the history for session &quot;{deleteTarget?.sessionName}&quot;? This action cannot be undone.
          </Paragraph>
        </Modal>
      </div>
    </>
  );
};

export default History;