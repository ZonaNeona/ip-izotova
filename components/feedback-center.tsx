"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, CircleHelp } from "lucide-react";
import { ReviewsCenter } from "@/components/reviews-center";
import { QuestionsCenter } from "@/components/questions-center";

type Tab = "reviews" | "questions";

export function FeedbackCenter({
  onQueueChange,
}: {
  onQueueChange?: (count: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("reviews");
  const [reviewQueue, setReviewQueue] = useState(141);
  const [questionQueue, setQuestionQueue] = useState(12);

  useEffect(() => {
    onQueueChange?.(reviewQueue + questionQueue);
  }, [reviewQueue, questionQueue, onQueueChange]);

  return (
    <div className="feedback-center">
      <div className="feedback-tabs card">
        <button
          className={tab === "reviews" ? "active" : ""}
          onClick={() => setTab("reviews")}
        >
          <MessageSquareText size={17} />
          Отзывы
          <span>{reviewQueue}</span>
        </button>
        <button
          className={tab === "questions" ? "active" : ""}
          onClick={() => setTab("questions")}
        >
          <CircleHelp size={17} />
          Вопросы
          <span>{questionQueue}</span>
        </button>
      </div>

      {tab === "reviews" ? (
        <ReviewsCenter onQueueChange={setReviewQueue} />
      ) : (
        <QuestionsCenter onQueueChange={setQuestionQueue} />
      )}
    </div>
  );
}
