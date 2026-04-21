"use client";

import React, { useState, useEffect } from "react";
import styles from "@/styles/curtain.module.css";

interface CurtainIntroProps {
  onComplete: () => void;
}

export default function CurtainIntro({ onComplete }: CurtainIntroProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(true);

  const handleEnter = () => {
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setIsRendered(false);
        onComplete();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onComplete]);

  if (!isRendered) {
    return null;
  }

  return (
    <div className={`${styles.scene} ${isOpen ? styles.open : styles.closed}`}>
      <div className={styles.curtainLeft}></div>
      <div className={styles.curtainRight}></div>

      {!isOpen && (
        <button className={styles.enterButton} onClick={handleEnter}>
          Click to Enter
        </button>
      )}
    </div>
  );
}
