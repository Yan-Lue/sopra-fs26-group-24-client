"use client";

import { useApi } from "@/hooks/useApi";
import { Button, Card, Divider, Space, Spin, Tag, Typography, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface SessionPutDTO {
  id: number;
  token: string;
}

interface SessionResponse {
  sessionId: number;
  sessionCode: string;
  sessionToken: string;
  hostId: number;
}

interface MovieGetDTO {
  movieId: number;
  title: string;
  description: string;
  posterPath: string;
  rating: number;
  releaseDate: string;
  genres: string[];
  similarMovies?: unknown[];
}

const VotePage: React.FC = () => {
  const apiService = useApi();
  const router = useRouter();
  const params = useParams();
  const routeSessionCode = params.sessionCode as string;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [movie, setMovie] = useState<MovieGetDTO | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const parseStorageValue = <T,>(raw: string | null): T | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  };

  const posterUrl = useMemo(() => {
    if (!movie?.posterPath) return "";
    if (movie.posterPath.startsWith("http")) return movie.posterPath;
    return `https://image.tmdb.org/t/p/w500${movie.posterPath}`;
  }, [movie]);

  useEffect(() => {
    const verifySessionAccessAndLoadMovie = async () => {
      const token = parseStorageValue<string>(localStorage.getItem("token"));
      const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
      const parsedUserId = Number(userIdRaw);

      if (!token || Number.isNaN(parsedUserId) || !routeSessionCode) {
        sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
        router.replace("/login");
        return;
      }

      const payload: SessionPutDTO = {
        id: parsedUserId,
        token,
      };

      try {
        await apiService.put<SessionResponse>(`/session/${routeSessionCode}`, payload);
        setIsAuthorized(true);

        const nextMovie = await apiService.get<MovieGetDTO>(`/session/${routeSessionCode}/next`);
        setMovie(nextMovie);
      } catch (error) {
        console.error("Failed to verify session or load next movie:", error);
        setErrorMessage("Failed to load the voting screen.");
        messageApi.error("Failed to load the movie for voting.");
        router.replace("/play");
      } finally {
        setIsLoading(false);
      }
    };

    void verifySessionAccessAndLoadMovie();
  }, [apiService, messageApi, routeSessionCode, router]);

  // implement real voting logic when backend is ready, for now just show a message
  const handleVoteClick = (vote: "x" | "skip" | "heart") => {
    messageApi.info(`Vote button clicked: ${vote}`);
  };

  if (isLoading) {
    return (
      <div className="page-with-nav">
        {contextHolder}
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

      <div className="play-container">
        <Card className="play-card vote-card">

          {!movie ? (
            <div className="host-loading-wrap" style={{ minHeight: 380 }}>
              <Spin size="large" />
            </div>
          ) : (
            <div className="vote-screen">
              <div className="vote-poster-wrap">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={movie.title}
                    className="vote-poster"
                  />
                ) : (
                  <div className="vote-poster-placeholder">
                    <Typography.Text>No poster available</Typography.Text>
                  </div>
                )}
              </div>

              <div className="vote-info">
                <Typography.Title level={2} style={{ marginBottom: 8 }}>
                  {movie.title}
                </Typography.Title>

                <Space size={[8, 8]} wrap style={{ marginBottom: 16 }}>
                  <Tag color="gold">Rating: {movie.rating?.toFixed(1) ?? "N/A"}</Tag>
                  <Tag color="blue">
                    {movie.releaseDate ? movie.releaseDate.slice(0, 4) : "Unknown year"}
                  </Tag>
                </Space>

                <Space size={[8, 8]} wrap style={{ marginBottom: 16 }}>
                  {movie.genres?.map((genre) => (
                    <Tag key={genre}>{genre}</Tag>
                  ))}
                </Space>

                <Typography.Paragraph className="vote-description">
                  {movie.description || "No description available."}
                </Typography.Paragraph>
              </div>

              <Divider />

              <div className="vote-actions">
                <Button shape="circle" size="large" danger onClick={() => handleVoteClick("x")} className="vote-action-button vote-action-x">
                    ✕
                </Button>

                <Button shape="circle" size="large" onClick={() => handleVoteClick("skip")} className="vote-action-button vote-action-skip">
                    -
                </Button>

                <Button shape="circle" size="large" type="primary" onClick={() => handleVoteClick("heart")} className="vote-action-button vote-action-heart">
                    ♥
                </Button>
                </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default VotePage;