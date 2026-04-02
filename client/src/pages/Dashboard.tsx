import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/my-swings", { replace: true }); }, []);
  return null;
}
