import express from "express";
import serverless from "serverless-http";
// Import your Express app router logic here
import { app } from "../../server";

// Export the serverless runtime handler
export const handler = serverless(app);
