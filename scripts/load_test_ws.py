#!/usr/bin/env python3
"""
Load test script for WebSocket real-time logging
Tests rate limiting and performance under concurrent load
"""

import asyncio
import aiohttp
import json
import time
import websockets
from datetime import datetime
import sys

class WebSocketLogClient:
    def __init__(self, url: str, client_id: int, severity_filter: str = None):
        self.url = url
        self.client_id = client_id
        self.severity_filter = severity_filter
        self.messages_received = 0
        self.errors = 0
        self.last_message_time = None
        self.websocket = None
        
    async def connect(self, token: str):
        """Connect to WebSocket endpoint"""
        try:
            uri = f"{self.url}?token={token}"
            self.websocket = await websockets.connect(uri)
            
            # Send subscription message
            await self.websocket.send(json.dumps({
                "type": "subscribe",
                "severity_filter": self.severity_filter
            }))
            
            return True
        except Exception as e:
            print(f"Client {self.client_id}: Connection failed: {e}")
            self.errors += 1
            return False
    
    async def receive_messages(self, duration: int):
        """Receive messages for specified duration"""
        start_time = time.time()
        
        try:
            while time.time() - start_time < duration:
                try:
                    message = await asyncio.wait_for(
                        self.websocket.recv(),
                        timeout=1.0
                    )
                    
                    data = json.loads(message)
                    if data.get("type") == "log_update":
                        self.messages_received += 1
                        self.last_message_time = time.time()
                        
                except asyncio.TimeoutError:
                    pass  # No message received in timeout
                    
        except Exception as e:
            self.errors += 1
            print(f"Client {self.client_id}: Error receiving: {e}")
    
    async def send_pings(self, interval: float = 30):
        """Send periodic pings to keep connection alive"""
        try:
            while self.websocket and self.websocket.open:
                await asyncio.sleep(interval)
                if self.websocket:
                    await self.websocket.send(json.dumps({"type": "ping"}))
        except Exception as e:
            self.errors += 1
    
    async def disconnect(self):
        """Disconnect gracefully"""
        if self.websocket:
            await self.websocket.close()
    
    def get_stats(self) -> dict:
        """Get connection statistics"""
        return {
            "client_id": self.client_id,
            "messages_received": self.messages_received,
            "errors": self.errors,
            "severity_filter": self.severity_filter
        }


class LoadTestRunner:
    def __init__(self, host: str = "localhost", port: int = 8000):
        self.host = host
        self.port = port
        self.base_url = f"ws://{host}:{port}"
        self.token = None
        self.clients = []
        
    async def get_token(self) -> str:
        """Get JWT token from backend"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"http://{self.host}:{self.port}/api/auth/login",
                json={"username": "admin", "password": "admin"}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("access_token")
                else:
                    raise Exception("Failed to get token")
    
    async def run(self, num_clients: int = 10, duration: int = 60):
        """Run load test with specified number of clients"""
        print(f"🚀 Starting load test")
        print(f"   Clients: {num_clients}")
        print(f"   Duration: {duration}s")
        print(f"   Target: ws://{self.host}:{self.port}/api/ws/logs")
        
        try:
            # Get authentication token
            print("\n📝 Authenticating...")
            self.token = await self.get_token()
            print(f"✓ Token obtained")
            
            # Create clients
            print(f"\n🔌 Creating {num_clients} WebSocket clients...")
            for i in range(num_clients):
                # Alternate between severity filters
                severity = ["Error", "Warning", None][i % 3]
                client = WebSocketLogClient(
                    f"{self.base_url}/api/ws/logs",
                    client_id=i,
                    severity_filter=severity
                )
                
                if await client.connect(self.token):
                    self.clients.append(client)
                    print(f"  ✓ Client {i}: Connected (filter={severity})")
                    await asyncio.sleep(0.1)  # Stagger connections
                else:
                    print(f"  ✗ Client {i}: Failed to connect")
            
            print(f"\n✓ {len(self.clients)} clients connected")
            
            # Start receiving messages
            print(f"\n📡 Receiving messages for {duration}s...")
            start_time = time.time()
            
            tasks = [
                asyncio.create_task(client.receive_messages(duration))
                for client in self.clients
            ]
            
            tasks.extend([
                asyncio.create_task(client.send_pings())
                for client in self.clients
            ])
            
            # Run for specified duration
            await asyncio.sleep(duration)
            
            # Cancel ping tasks
            for task in tasks:
                task.cancel()
            
            # Disconnect all clients
            print(f"\n🔌 Disconnecting clients...")
            for client in self.clients:
                await client.disconnect()
            
            # Print results
            self.print_results()
            
        except Exception as e:
            print(f"\n❌ Load test error: {e}")
            import traceback
            traceback.print_exc()
    
    def print_results(self):
        """Print test results"""
        total_messages = sum(c.messages_received for c in self.clients)
        total_errors = sum(c.errors for c in self.clients)
        avg_messages = total_messages / len(self.clients) if self.clients else 0
        
        print("\n" + "="*60)
        print("📊 LOAD TEST RESULTS")
        print("="*60)
        print(f"Clients:              {len(self.clients)}")
        print(f"Total messages:       {total_messages}")
        print(f"Avg / client:         {avg_messages:.0f}")
        print(f"Total errors:         {total_errors}")
        print()
        
        if total_messages > 0:
            print("Per-client breakdown:")
            print(f"{'Client':<8} {'Messages':<12} {'Errors':<8} {'Filter':<12}")
            print("-" * 50)
            for client in self.clients:
                stats = client.get_stats()
                print(f"{stats['client_id']:<8} "
                      f"{stats['messages_received']:<12} "
                      f"{stats['errors']:<8} "
                      f"{stats['severity_filter'] or 'None':<12}")
        
        print("="*60)


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="WebSocket load test")
    parser.add_argument("--host", default="localhost", help="Backend host")
    parser.add_argument("--port", type=int, default=8000, help="Backend port")
    parser.add_argument("--clients", type=int, default=10, help="Number of clients")
    parser.add_argument("--duration", type=int, default=60, help="Test duration (seconds)")
    
    args = parser.parse_args()
    
    runner = LoadTestRunner(host=args.host, port=args.port)
    await runner.run(num_clients=args.clients, duration=args.duration)


if __name__ == "__main__":
    asyncio.run(main())
