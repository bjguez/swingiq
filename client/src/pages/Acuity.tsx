import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Acuity() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/enhance?tab=acuity", { replace: true }); }, []);
  return null;
}
