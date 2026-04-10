"use client";

import { useApi } from "@/hooks/useApi";
import { getApiDomain } from "@/utils/domain";
import { Client } from "@stomp/stompjs";
import { Button, Card, Divider, Space, Spin, Tag, Typography, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import SockJS from "sockjs-client";
import { useEffect, useMemo, useState } from "react";

/** 
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
*/

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

interface VotePutDTO {
  userId: number;
  movieId: number;
  score: number;
  sessionCode: string;
  token: string;
}

const VotePage: React.FC = () => {
  const apiService = useApi();
  const router = useRouter();
  const params = useParams();
  const routeSessionCode = params.sessionCode as string;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [movie, setMovie] = useState<MovieGetDTO | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [votedMovieIds, setVotedMovieIds] = useState<number[]>([]);
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

  const getSocketEndpoint = () => {
    const apiDomain = getApiDomain().replace(/\/$/, "");
    return `${apiDomain}/gs-guide-websocket`;
  };

  useEffect(() => {
    const storedVotes = parseStorageValue<number[]>(
      sessionStorage.getItem(`votedMovieIds:${routeSessionCode}`),
    );
    if (storedVotes && Array.isArray(storedVotes)) {
      setVotedMovieIds(storedVotes);
    }
  }, [routeSessionCode]);

  useEffect(() => {
    const connectVoteSocket = async () => {
      const token = parseStorageValue<string>(localStorage.getItem("token"));
      const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
      const parsedUserId = Number(userIdRaw);

      if (!token || Number.isNaN(parsedUserId) || !routeSessionCode) {
        sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
        router.replace("/login");
        return;
      }

      const cachedMovie = parseStorageValue<MovieGetDTO>(
        sessionStorage.getItem(`currentMovie:${routeSessionCode}`),
      );
      if (cachedMovie) {
        setMovie(cachedMovie);
        setIsLoading(false);
      }

      setIsAuthorized(true);

      const client = new Client({
        webSocketFactory: () => new SockJS(getSocketEndpoint()),
        //built-in from stopjs, waits 5 seconds before trying to reconnect after connection loss (in ms)
        reconnectDelay: 5000,
        onConnect: () => {
          client.subscribe(
            `/topic/session/${routeSessionCode}/next`,
            (frame: { body: string }) => {
              try {
                const nextMovie = JSON.parse(frame.body) as MovieGetDTO;
                setMovie(nextMovie);
                setIsLoading(false);
                sessionStorage.setItem(`currentMovie:${routeSessionCode}`, JSON.stringify(nextMovie));
              } catch (error) {
                console.error("Failed to parse next movie in vote page:", error);
              }
            },
          );
        },
        //log STOMP errors to console
        onStompError: (frame: { headers: Record<string, string> }) => {
          console.error("STOMP error:", frame.headers["message"]);
          messageApi.error(`Connection error: ${frame.headers["message"]}`);
        },
      });

      client.activate();
      if (!cachedMovie) {
        setIsLoading(true);
      }

      return client;
    };

    let activeClient: Client | undefined = undefined;
    void connectVoteSocket().then((client) => {
      activeClient = client;
    });

    return () => {
      if (activeClient) {
        void activeClient.deactivate();
      }
    };
  }, [routeSessionCode, router]);

  const handleVoteClick = async (vote: "x" | "skip" | "heart") => {
    //first check if movie data is loaded and if a vote submission is already in progress
    if (!movie || isSubmittingVote) {
      return;
    }
    //frontend message to prevent multiple votes for same movei (handled in backend)
    if (votedMovieIds.includes(movie.movieId)) {
      messageApi.info("You already voted for this movie.");
      return;
    }

    const token = parseStorageValue<string>(localStorage.getItem("token"));
    const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
    const parsedUserId = Number(userIdRaw);

    //check if (still) logged in etc... not that crucial :)
    if (!token || Number.isNaN(parsedUserId)) {
      messageApi.error("Your session has expired. Please log in again.");
      router.replace("/login");
      return;
    }

    const scoreMap: Record<"x" | "skip" | "heart", number> = {
      x: -1,
      skip: 0,
      heart: 1,
    };

    const votePayload: VotePutDTO = {
      userId: parsedUserId,
      movieId: movie.movieId,
      score: scoreMap[vote],
      sessionCode: routeSessionCode,
      token,
    };

    try {
      setIsSubmittingVote(true);
      await apiService.post<string>(`/session/${routeSessionCode}/vote`, votePayload);
      const nextVotedMovieIds = [...votedMovieIds, movie.movieId];
      setVotedMovieIds(nextVotedMovieIds);
      sessionStorage.setItem(
        `votedMovieIds:${routeSessionCode}`,
        JSON.stringify(nextVotedMovieIds),
      );
      messageApi.success("Vote submitted.");
    } catch (error) {
      //console.error("Failed to submit vote:", error);
      messageApi.error("Failed to submit vote. Please try again.");
    } finally {
      setIsSubmittingVote(false);
    }
  };

  //should prevent multiples votes for same movie 
  const hasVotedCurrentMovie = movie ? votedMovieIds.includes(movie.movieId) : false;
  const isWaitingForNextMovie = hasVotedCurrentMovie && !isSubmittingVote;

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
                <Button shape="circle" size="large" danger disabled={isSubmittingVote || hasVotedCurrentMovie} onClick={() => void handleVoteClick("x")} className="vote-action-button vote-action-x">
                    ✕
                </Button>

                <Button shape="circle" size="large" disabled={isSubmittingVote || hasVotedCurrentMovie} onClick={() => void handleVoteClick("skip")} className="vote-action-button vote-action-skip">
                    -
                </Button>

                <Button shape="circle" size="large" type="primary" disabled={isSubmittingVote || hasVotedCurrentMovie} onClick={() => void handleVoteClick("heart")} className="vote-action-button vote-action-heart">
                    ♥
                </Button>
                </div>

              <div className="vote-waiting-message">
                {isSubmittingVote ? (
                  <>
                    <Spin size="small" />
                    <Typography.Text>Submitting your vote...</Typography.Text>
                  </>
                ) : isWaitingForNextMovie ? (
                  <>
                    <Spin size="small" />
                    <Typography.Text>  Vote saved. Waiting for the next movie...</Typography.Text>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default VotePage;