"use client";

import { useApi } from "@/hooks/useApi";
import { clearSessionClientState, parseStorageValue } from "@/utils/storage";
import { StarFilled, StarOutlined } from "@ant-design/icons";
import { Button, Card, Collapse, Form, Input, Modal, Select, Spin, Typography, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface CreateSessionFormValues {
  sessionName: string;
  maxPlayers: number;
}

interface CreateSessionPayload extends CreateSessionFormValues {
  hostId: number;
}

interface SessionResponse {
id: number;
sessionCode: string;
sessionToken: string;
hostId: number;
}

interface SimilarMovieDTO {
movieId: number;
title: string;
posterPath?: string;
rating?: number;
releaseDate?: string;
}

interface MovieResultDTO {
movieId: number;
title: string;
description?: string;
posterPath: string;
rating?: number;
releaseDate?: string;
genres?: string[];
similarMovies?: SimilarMovieDTO[];
score: number;
likes?: number;
dislikes?: number;
neutrals?: number;
}

const playerOptions = Array.from({ length: 16 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1}`,
}));

const ResultsPage: React.FC = () => {
const apiService = useApi();
const router = useRouter();
const params = useParams();
const routeSessionCode = params.sessionCode as string;

const [isAuthorized, setIsAuthorized] = useState(false);
const [loading, setLoading] = useState(true);
const [isHost, setIsHost] = useState(false);
const [movieResults, setMovieResults] = useState<MovieResultDTO[]>([]);
const [messageApi, contextHolder] = message.useMessage();
const [isSavingToHistory, setIsSavingToHistory] = useState(false);
const [isGuest, setIsGuest] = useState(false);
const [isHistorySaved, setIsHistorySaved] = useState(false);
const [isModalVisible, setIsModalVisible] = useState(false);
const [createForm] = Form.useForm<CreateSessionFormValues>();
const [modal, contextHolderModal] = Modal.useModal();

const getPosterUrl = (posterPath: string): string => {
    if (!posterPath) return "";
    if (posterPath.startsWith("http")) return posterPath;
    return `https://image.tmdb.org/t/p/w500${posterPath}`;
};

useEffect(() => {
    const loadResults = async () => {
        const token = parseStorageValue<string>(localStorage.getItem("token"));
        const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
        const parsedUserId = Number(userIdRaw);

        if (!token || Number.isNaN(parsedUserId) || !routeSessionCode) {
            sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
            router.replace("/login");
            return;
        }

        setIsGuest(token.startsWith("Guest-"));

        const historyKey = `historySaved:${routeSessionCode}:${parsedUserId}`;
        setIsHistorySaved(localStorage.getItem(historyKey) === "true");

        const storedHostIdRaw = parseStorageValue<string | number>(localStorage.getItem("hostId"));
        const storedHostId = Number(storedHostIdRaw);
        setIsHost(!Number.isNaN(storedHostId) && storedHostId === parsedUserId);

    try {
        setIsAuthorized(true);

        const results = await apiService.get<MovieResultDTO[]>(`/session/${routeSessionCode}/results`);
        setMovieResults(Array.isArray(results) ? results : []);
    } catch (error) {
        console.error("Failed to verify session or load results:", error);
        messageApi.error("Failed to load the session results.");
        router.replace("/play");
    } finally {
        setLoading(false);
    }
    };

    void loadResults();
}, [apiService, messageApi, routeSessionCode, router]);

const handleSaveToHistory = async () => {
  if (isGuest || isHistorySaved) return;

  setIsSavingToHistory(true);
  try {
    const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
    const parsedUserId = Number(userIdRaw);
    const historyKey = `historySaved:${routeSessionCode}:${parsedUserId}`;

    // TODO: call backend endpoint later, endpoint name can be changed, just a first idea
    // await apiService.post(`/users/${parsedUserId}/history`, { sessionCode: routeSessionCode });

    localStorage.setItem(historyKey, "true");
    setIsHistorySaved(true);
    messageApi.success("Session saved to history.");
  } catch (error) {
    console.error("Failed to save to history:", error);
    messageApi.error("Failed to save session to history.");
  } finally {
    setIsSavingToHistory(false);
  }
};

// TODO: redirect all users via websocket after host starts new round
const handleStartNewRound = async () => {
    if (!isHost) {
    messageApi.warning("Only the host can start a new round.");
    return;
    }

    setIsModalVisible(true);
};

const handleConfirmNewRound = async () => {
  try {
    createForm.setFields([{ name: "sessionName", errors: [] }]);
    const values = await createForm.validateFields();
    const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
    const parsedUserId = Number(userIdRaw);

    const payload: CreateSessionPayload = {
      sessionName: values.sessionName,
      maxPlayers: values.maxPlayers,
      hostId: parsedUserId,
    };

    const session = await apiService.post<SessionResponse>("/session", payload);

    localStorage.setItem("sessionCode", session.sessionCode);
    localStorage.setItem("hostId", session.hostId.toString());

    setIsModalVisible(false);
    router.push(`/session/${session.sessionCode}`);
  } catch (error) {
    console.error("Failed to start new round:", error);
    createForm.setFields([
        { name: "sessionName", errors: ["Please enter a valid session name."] },
      ]);
  }
};

const handleLeaveSession = () => {
  clearSessionClientState(routeSessionCode);
  router.replace("/home");
};

const handleConfirmLeave = () => {
  modal.confirm({
    className: "leave-session-confirm-modal",
    title: "Do you really want to end the session?",
    content: "You will be redirected to the home page.",
    okText: "Yes, leave",
    cancelText: "No, stay",
    onOk: async () => {
      sessionStorage.setItem(
        "redirectInfo",
        "You successfully ended the session."
      );
      handleLeaveSession();
    },
  });
};

const moviesSortedByScore = [...movieResults].sort((a, b) => b.score - a.score);

if (loading) {
    return (
    <div className="page-with-nav">
        {contextHolder}
        {contextHolderModal}
        <div className="play-container host-loading-wrap">
        <Spin size="large" />
        </div>
    </div>
    );
}

if (!isAuthorized) {
    return null;
}

return (
    <div className="page-with-nav">
      {contextHolder}
      {contextHolderModal}

      <div className="results-container">
        <div className="results-header-row">
          <div className="results-header">
            <Typography.Title level={2} style={{ marginBottom: 0 }}>
              Session Results
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>
              Final Results
            </Typography.Text>
          </div>

          {!isGuest && (
            <Button
              type="primary"
              size="large"
              className={`save-to-history-btn ${isHistorySaved ? "saved" : ""}`}
              onClick={handleSaveToHistory}
              loading={isSavingToHistory}
              icon={isHistorySaved ? <StarFilled /> : <StarOutlined />}
            >
              {isHistorySaved ? "Saved to History" : "Save to History"}
            </Button>
          )}
        </div>

        <div className="results-list">
          {movieResults.length === 0 ? (
            <div className="results-empty">
              <Spin size="large" />
              <Typography.Text style={{ marginTop: 16 }}>Loading results...</Typography.Text>
            </div>
          ) : (
            moviesSortedByScore.map((movie) => {
              const posterUrl = getPosterUrl(movie.posterPath);
              const score = movie.score ?? 0;

              return (
                <Card key={movie.movieId} className="result-item-card">
                <div className="result-item-content">
                    <div className="result-item-poster">
                    {posterUrl ? (
                        <img
                        src={posterUrl}
                        alt={movie.title}
                        className="result-item-image"
                        />
                    ) : (
                        <div className="result-item-placeholder">
                        <Typography.Text>No poster</Typography.Text>
                        </div>
                    )}
                    </div>

                    <div className="result-item-info">
                        <Typography.Title level={4} style={{ marginBottom: 8 }}>
                            {movie.title}
                        </Typography.Title>

                        <div className="result-item-tags">
                            <Typography.Text className="result-item-meta">
                                {movie.likes ?? 0} likes • {movie.dislikes ?? 0} dislikes • {movie.neutrals ?? 0} neutral
                            </Typography.Text>

                            <div className="vote-info">
                                <Typography.Paragraph className="vote-description" style={{ marginBottom: 10 }}>
                                {movie.description ?? "No description available yet."}
                                </Typography.Paragraph>

                            <div className="result-tags-row">
                                <span className="result-tag">{movie.rating ? `Rating: ${movie.rating.toFixed(1)}` : "No rating"}</span>
                                <span className="result-tag">
                                {movie.releaseDate ? movie.releaseDate.slice(0, 4) : "Unknown year"}
                                </span>
                            </div>

                            <div className="result-tags-row">
                                {movie.genres?.map((genre) => (
                                <span key={genre} className="result-tag">
                                    {genre}
                                </span>
                                ))}
                            </div>

                            <Collapse
                              ghost
                              size="small"
                              className="result-similar-collapse"
                              items={[
                                {
                                  key: "similar-" + movie.movieId,
                                  label: `Similar movies (${movie.similarMovies?.length ?? 0})`,
                                  children:
                                    movie.similarMovies && movie.similarMovies.length > 0 ? (
                                      <div className="similar-movies-list">
                                        {movie.similarMovies.map((similar) => {
                                          const similarPoster = similar.posterPath
                                            ? getPosterUrl(similar.posterPath)
                                            : "";

                                          return (
                                            <div key={similar.movieId} className="similar-movie-item">
                                              {similarPoster ? (
                                                <img
                                                  src={similarPoster}
                                                  alt={similar.title}
                                                  className="similar-movie-poster"
                                                />
                                              ) : (
                                                <div className="similar-movie-poster-placeholder">No poster</div>
                                              )}

                                              <div className="similar-movie-info">
                                                <Typography.Text className="similar-movie-title">
                                                  {similar.title}
                                                </Typography.Text>
                                                <Typography.Text className="similar-movie-meta">
                                                  {similar.rating
                                                    ? `Rating: ${similar.rating.toFixed(1)}`
                                                    : "No rating"}{" "}
                                                  •{" "}
                                                  {similar.releaseDate
                                                    ? similar.releaseDate.slice(0, 4)
                                                    : "Unknown year"}
                                                </Typography.Text>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <Typography.Text type="secondary">
                                        No similar movies available.
                                      </Typography.Text>
                                    ),
                                },
                              ]}
                            />
                            </div>
                        </div>
                    </div>

                    <div className="result-item-score">
                    <div
                        className="score-badge"
                        style={{
                        backgroundColor:
                            score > 0 ? "#72f681" : score < 0 ? "#ff4d4f" : "#d9d9d9",
                        }}
                    >
                        {score > 0 ? "+" : ""}
                        {score}
                    </div>
                    </div>
                </div>
                </Card>
            );
            })
        )}
        </div>

        <div className="results-actions">
          <div className="results-bottom-actions">
            {isHost && (
              <Button
                type="primary"
                size="large"
                className="start-new-round-btn"
                onClick={handleStartNewRound}
              >
                Start New Round
              </Button>
            )}
            <Button
              size="large"
              className="leave-session-btn"
              onClick={handleConfirmLeave}
            >
              Leave Session
            </Button>
          </div>
        </div>
      </div>
    <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        closable
        destroyOnHidden
        className="start-new-round-modal"
        title="Start New Round"
        >
        <Form form={createForm} layout="vertical" onFinish={handleConfirmNewRound}>
            <Form.Item
            name="sessionName"
            label="Session Name"
            rules={[{ required: true, message: "Please input a session name!" }]}
            >
            <Input placeholder="Enter a Session name" />
            </Form.Item>

            <Form.Item
            name="maxPlayers"
            label="Number of Players"
            rules={[{ required: true, message: "Please input the number of players!" }]}
            >
            <Select placeholder="Select the number of players..." options={playerOptions} />
            </Form.Item>

            <Form.Item style={{ textAlign: "center"}}>
            <Button type="primary" htmlType="submit" className="create-session-btn">
                Create Session
            </Button>
            </Form.Item>
        </Form>
    </Modal>
    </div>
  );
};

export default ResultsPage;
