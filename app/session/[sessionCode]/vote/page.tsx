"use client";

import { useApi } from "@/hooks/useApi";
import { getApiDomain } from "@/utils/domain";
import { parseStorageValue } from "@/utils/storage";
import { Client } from "@stomp/stompjs";
import { Button, Card, Divider, Space, Spin, Tag, Typography, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import SockJS from "sockjs-client";

//useRef allows us to keep track of whether we're currently advancing to the next movie, preventing multiple simultaneous advances if the timer triggers while an advance is already in progress.

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
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [timePerRound, setTimePerRound] = useState<number | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [isHost, setIsHost] = useState(false);
  const isAdvancingRef = useRef(false);
  const lastMovieIdRef = useRef<number | null>(null);

  const getMovieId = (m: MovieGetDTO | (MovieGetDTO & { id?: number }) | null): number | null => {
    if (!m) return null;
    if (typeof m.movieId === "number") return m.movieId;
    const fallback = (m as { id?: unknown }).id;
    return typeof fallback === "number" ? fallback : null;
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

      const storedHostIdRaw = parseStorageValue<string | number>(localStorage.getItem("hostId"));
      const storedHostId = Number(storedHostIdRaw);
      setIsHost(!Number.isNaN(storedHostId) && storedHostId === parsedUserId);

      try {
        const serverTimePerRound = await apiService.get<number>(`/session/${routeSessionCode}/time`);
        if (typeof serverTimePerRound === "number" && serverTimePerRound > 0) {
          setTimePerRound(serverTimePerRound);
        }
      } catch {
        // Optional fallback to local cache if request fails
        const localRaw = sessionStorage.getItem(`timePerRound:${routeSessionCode}`);
        const localValue = localRaw ? Number(localRaw) : null;
        if (localValue && localValue > 0) {
          setTimePerRound(localValue);
        }
      }


      const cachedMovie = parseStorageValue<MovieGetDTO>(
        sessionStorage.getItem(`currentMovie:${routeSessionCode}`),
      );
      if (cachedMovie) {
        setMovie(cachedMovie);
      }

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
                sessionStorage.setItem(`currentMovie:${routeSessionCode}`, JSON.stringify(nextMovie));
              } catch (error) {
                console.error("Failed to parse next movie in vote page:", error);
              }
            },
          );
          
          // Backend sends payload to indicate no more movies are left
          client.subscribe(`/topic/session/${routeSessionCode}/end`, (frame: { body: string }) => {
            // trim any whitespace and remove quotes
            const normalizeCode = (value: string) => value.trim().replace(/^"(.*)"$/, "$1");

            let endedSessionCode: string | null = null;
            try {
              const payload = JSON.parse(frame.body) as unknown;
              if (typeof payload === "string") {
                endedSessionCode = normalizeCode(payload);
              } else if (payload && typeof payload === "object" && "sessionCode" in payload) {
                const value = (payload as { sessionCode?: unknown }).sessionCode;
                endedSessionCode = typeof value === "string" ? value : null;
              } 
            } catch {
                endedSessionCode = normalizeCode(frame.body);
            }

            const currentSessionCode = normalizeCode(routeSessionCode);

            // prevent accidental redirect if we receive a message for a different session
            if (endedSessionCode && endedSessionCode !== currentSessionCode) {
              return;
            }

            sessionStorage.removeItem("currentMovie:" + routeSessionCode);
            sessionStorage.removeItem("votedMovieIds:" + routeSessionCode);
            router.replace(`/session/${routeSessionCode}/results`);
          });
        },
        //log STOMP errors to console
        onStompError: (frame: { headers: Record<string, string> }) => {
          console.error("STOMP error:", frame.headers["message"]);
          messageApi.error(`Connection error: ${frame.headers["message"]}`);
        },
      });

      client.activate();
      setIsAuthorized(true);
      setIsLoading(false);

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
  }, [apiService, messageApi, routeSessionCode, router]);

  // Auto-advance to next movie after timePerRound seconds
  // 1. Reset the numeric state whenever a new movie arrives
  useEffect(() => {
    if (!movie || isLoading || !timePerRound) return;

    const currentMovieId = getMovieId(movie);
    
    // Only reset if it's actually a different movie
    if (currentMovieId !== lastMovieIdRef.current) {
      // Store the ID of the current movie to compare on the next update
      lastMovieIdRef.current = currentMovieId;
      setTimeRemaining(timePerRound);
    }
  }, [movie, isLoading, timePerRound]);

  // 2. The Countdown Heartbeat
  useEffect(() => {
    // If no time is set, don't start the clock
    if (!timePerRound || timePerRound <= 0) return;


    // countdownInterval will get an ID that we can then use to clear
    const countdownInterval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          
          // CRITICAL: Only the host triggers the API to move everyone to the next movie
          if (isHost && !isAdvancingRef.current) {
            void advanceToNextMovie();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // This cleanup function runs every time the 'movie' changes,
    // the old timer is gone and a new one can start.
    return () => clearInterval(countdownInterval);
    
    // Adding 'movie' here is what prevents the "freeze"
  }, [movie, timePerRound, isHost]);

  const advanceToNextMovie = async () => {
    if (!isHost || isAdvancingRef.current) {
      return;
    }

    isAdvancingRef.current = true;

    try {
      const nextMovie = await apiService.get<MovieGetDTO>(`/session/${routeSessionCode}/next`);
      setMovie(nextMovie);
      sessionStorage.setItem(`currentMovie:${routeSessionCode}`, JSON.stringify(nextMovie));
    } catch (error) {
      const apiError = error as { status?: number };
      // currently left in to still redirect as fallback
      if (apiError?.status === 409) {
        router.replace(`/session/${routeSessionCode}/results`);
        messageApi.info("Session ended. Redirecting to results...");
        return;
      }
    } finally {
      isAdvancingRef.current = false;
    }
  };

  const handleVoteClick = async (vote: "x" | "skip" | "heart") => {
    //first check if movie data is loaded and if a vote submission is already in progress
    if (!movie || isSubmittingVote) {
      return;
    }

    const resolvedMovieId = getMovieId(movie);
    if (!resolvedMovieId) {
      messageApi.error("Movie data not ready yet. Please wait and try again.");
      return;
    }

    //frontend message to prevent multiple votes for same movei (handled in backend)
    if (votedMovieIds.includes(resolvedMovieId)) {
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
      movieId: resolvedMovieId,
      score: scoreMap[vote],
      sessionCode: routeSessionCode,
      token,
    };

    try {
      setIsSubmittingVote(true);
      await apiService.post<string>(`/session/${routeSessionCode}/vote`, votePayload);
      const nextVotedMovieIds = [...votedMovieIds, resolvedMovieId];
      setVotedMovieIds(nextVotedMovieIds);
      sessionStorage.setItem(
        `votedMovieIds:${routeSessionCode}`,
        JSON.stringify(nextVotedMovieIds),
      );
      messageApi.success("Vote submitted.");
    } catch (error) {
      console.error("Failed to submit vote:", error);
      messageApi.error("Failed to submit vote. Please try again.");
    } finally {
      setIsSubmittingVote(false);
    }
  };

  //should prevent multiples votes for same movie 
  const currentMovieId = getMovieId(movie);
  const hasVotedCurrentMovie = currentMovieId ? votedMovieIds.includes(currentMovieId) : false;
  const isWaitingForNextMovie = hasVotedCurrentMovie && !isSubmittingVote;

  useEffect(() => {
    if (!routeSessionCode || isHost || !isWaitingForNextMovie) {
      return;
    }

    let cancelled = false;

    const pollCurrentMovie = async () => {
      if (cancelled) return;

      try {
        const currentMovie = await apiService.get<MovieGetDTO>(`/session/${routeSessionCode}/current`);
        if (cancelled || !currentMovie) return;

        const currentMovieId = getMovieId(currentMovie);
        const existingMovieId = getMovieId(movie);
        if (currentMovieId === existingMovieId) return; // No change, don't update

        setMovie(currentMovie);
        sessionStorage.setItem(`currentMovie:${routeSessionCode}`, JSON.stringify(currentMovie));
      } catch (error) {
        const apiError = error as { status?: number };

        // here again, currently rely on 409 from backend to indicate session end 
        if (apiError?.status === 409) {
          sessionStorage.removeItem(`currentMovie:${routeSessionCode}`);
          sessionStorage.removeItem(`votedMovieIds:${routeSessionCode}`);
          router.replace(`/session/${routeSessionCode}/results`);
          return;
        }

        if (apiError?.status === 404) {
          return;
        }
      }
    };

    void pollCurrentMovie();
    const id = window.setInterval(() => {
      void pollCurrentMovie();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [routeSessionCode, isHost, isWaitingForNextMovie, apiService]);

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
            <div className="host-loading-wrap vote-loading-wrap">
              <Spin size="large" />
            </div>
          ) : isWaitingForNextMovie ? (
            <div className="host-loading-wrap vote-waiting-wrap">
              <Space orientation="vertical" size={12} className="vote-waiting-stack">
                <Spin size="large" />
                <Typography.Title level={3} className="vote-waiting-title">
                  Waiting for other players...
                </Typography.Title>
                <Typography.Text type="secondary">
                  Your vote is saved.
                </Typography.Text>
                {timeRemaining > 0 && (
                  <Typography.Text strong>
                    Next movie in {timeRemaining} seconds
                  </Typography.Text>
                )}
              </Space>
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
                <Typography.Title level={2} className="vote-title">
                  {movie.title}
                </Typography.Title>

                <Space size={[8, 8]} wrap className="vote-meta-row">
                  <Tag color="gold">Rating: {movie.rating?.toFixed(1) ?? "N/A"}</Tag>
                  <Tag color="blue">
                    {movie.releaseDate ? movie.releaseDate.slice(0, 4) : "Unknown year"}
                  </Tag>
                </Space>

                <Space size={[8, 8]} wrap className="vote-meta-row">
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