// Import the 'express' module along with 'Request' and 'Response' types from express
import express, { Request, Response, Express } from 'express';
import "dotenv/config";

// Create an Express application
const app: Express = express();

// Specify the port number for the server
const PORT: number = Number(process.env.PORT) ?? 3000;

// Define a route for the root path ('/')
app.get('/', (req: Request, res: Response) => {
  // Send a response to the client
  res.send('Hello, TypeScript + Node.js + Express!');
});

// Start the server and listen on the specified port
app.listen(PORT, () => {
  // Log a message when the server is successfully running
  console.log(`Server is running on http://localhost:${PORT}`);
});