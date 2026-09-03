"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "./button";
import { useToast } from "./toast";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  const { push } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      push({ title: "Copied!", message: "Code copied to clipboard", tone: "success" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      push({ title: "Failed", message: "Could not copy to clipboard", tone: "error" });
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleCopy} className="gap-2">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {label}
    </Button>
  );
}
