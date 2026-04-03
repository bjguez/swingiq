import { useEffect } from "react";
import { useLocation } from "wouter";

export default function VisionTraining() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/enhance?tab=cognition", { replace: true }); }, []);
  return null;
}
