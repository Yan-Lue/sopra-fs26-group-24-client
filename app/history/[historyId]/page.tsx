"use client";

import Navbar from "@/components/Navbar";
import { useApi } from "@/hooks/useApi";
import { parseStorageValue } from "@/utils/storage";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Typography, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const { Title, Text, Paragraph } = Typography;

interface HistoryMovieEntry {
  movieId: number;
  score: number;
}

interface HistoryDetail {
  historyId: number;
  sessionName: string;
  sessionCode: string;
  joinedUsers: number;
  creationDate: string;
  movies: HistoryMovieEntry[];
}

interface MovieInfo {
  movieId: number;
  title: string;
  description?: string;
  posterPath?: string;
  rating?: number;
  releaseDate?: string;
  genres?: string[];
}

const HistoryDetailPage: React.FC = () => {
  const apiService = useApi();
  const router = useRouter();
  const params = useParams();
  const historyId = params.historyId as string;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [history, setHistory] = useState<HistoryDetail | null>(null);
  const [movieDetails, setMovieDetails] = useState<Map<number, MovieInfo>>(new Map());
  const [messageApi, contextHolder] = message.useMessage();

  const fetchHistory = useCallback(async () => {
    const userId = parseStorageValue<string | number>(localStorage.getItem("userId"));
    if (!userId || !historyId) return;

    try {
      const data = await apiService.get<HistoryDetail>(`/users/${userId}/histories/${historyId}`);
      setHistory(data);

      // Fetch movie details for each movie in the history
      const details = new Map<number, MovieInfo>();
      const movieFetches = data.movies.map(async (entry) => {
        try {
          const movie = await apiService.get<MovieInfo>(`/movies/${entry.movieId}`);
          details.set(entry.movieId, movie);
        } catch (err) {
          console.error(`Failed to fetch movie ${entry.movieId}:`, err);
        }
      });

      await Promise.all(movieFetches);
      setMovieDetails(new Map(details));
    } catch (error) {
      console.error("Failed to fetch history detail:", error);
      messageApi.error("Failed to load history details.");
      router.replace("/history");
    }
  }, [apiService, historyId, messageApi, router]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    if (!token || !userId || token === "" || userId === "") {
      sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
      router.replace("/login");
      return;
    }

    setIsAuthorized(true);
    void fetchHistory();
  }, [router, fetchHistory]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getPosterUrl = (posterPath?: string): string => {
    if (!posterPath) return "";
    if (posterPath.startsWith("http")) return posterPath;
    return `https://image.tmdb.org/t/p/w500${posterPath}`;
  };

  if (!isAuthorized || !history) {
    return null;
  }

  const moviesSortedByScore = [...history.movies].sort((a, b) => b.score - a.score);

  return (
    <>
      {contextHolder}
      <div className="page-with-nav">
        <Navbar />

        <div className="results-container">
          <div className="results-header-row">
            <div className="results-header">
              <Title level={2} style={{ marginBottom: 0 }}>
                {history.sessionName}
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                {formatDate(history.creationDate)} • {history.joinedUsers} player{history.joinedUsers !== 1 ? "s" : ""} • {history.movies.length} movie{history.movies.length !== 1 ? "s" : ""}
              </Text>
            </div>

            <Button
              size="large"
              icon={<ArrowLeftOutlined />}
              className="history-back-btn"
              onClick={() => router.push("/history")}
            >
              Back to History
            </Button>
          </div>

          <div className="results-list">
            {moviesSortedByScore.length === 0 ? (
              <div className="results-empty">
                <Text>No movies in this session.</Text>
              </div>
            ) : (
              moviesSortedByScore.map((entry) => {
                const movie = movieDetails.get(entry.movieId);
                const posterUrl = movie ? getPosterUrl(movie.posterPath) : "";
                const score = entry.score ?? 0;

                return (
                  <Card key={entry.movieId} className="result-item-card">
                    <div className="result-item-content">
                      <div className="result-item-poster">
                        {posterUrl ? (
                          <img
                            src={posterUrl}
                            alt={movie?.title ?? `Movie ${entry.movieId}`}
                            className="result-item-image"
                          />
                        ) : (
                          <div className="result-item-placeholder">
                            <Text>No poster</Text>
                          </div>
                        )}
                      </div>

                      <div className="result-item-info">
                        <Title level={4} style={{ marginBottom: 8 }}>
                          {movie?.title ?? `Movie #${entry.movieId}`}
                        </Title>

                        <div className="result-item-tags">
                          <div className="vote-info">
                            <Paragraph className="vote-description" style={{ marginBottom: 10 }}>
                              {movie?.description ?? "No description available."}
                            </Paragraph>

                            <div className="result-tags-row">
                              <span className="result-tag">
                                {movie?.rating ? `Rating: ${movie.rating.toFixed(1)}` : "No rating"}
                              </span>
                              <span className="result-tag">
                                {movie?.releaseDate ? movie.releaseDate.slice(0, 4) : "Unknown year"}
                              </span>
                            </div>

                            {movie?.genres && movie.genres.length > 0 && (
                              <div className="result-tags-row">
                                {movie.genres.map((genre) => (
                                  <span key={genre} className="result-tag">
                                    {genre}
                                  </span>
                                ))}
                              </div>
                            )}
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
        </div>
      </div>
    </>
  );
};

export default HistoryDetailPage;
