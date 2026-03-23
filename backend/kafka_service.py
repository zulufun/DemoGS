"""Kafka producer/consumer for log streaming and batch processing"""

import logging
from typing import Optional, List, Dict, Any
from kafka import KafkaProducer, KafkaConsumer
from kafka.errors import KafkaError
import json
from config import settings
import threading
from datetime import datetime

logger = logging.getLogger(__name__)

kafka_producer: Optional[KafkaProducer] = None
kafka_consumer: Optional[KafkaConsumer] = None


async def init_kafka():
    """Initialize Kafka producer"""
    global kafka_producer
    try:
        kafka_producer = KafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            acks='all',  # Wait for all replicas
            retries=3,
            max_in_flight_requests_per_connection=1  # Ensure ordering
        )
        logger.info(f"Kafka producer initialized on {settings.KAFKA_BOOTSTRAP_SERVERS}")
    except Exception as e:
        logger.error(f"Failed to initialize Kafka producer: {e}")
        raise


async def close_kafka():
    """Close Kafka producer"""
    global kafka_producer
    if kafka_producer:
        kafka_producer.flush()
        kafka_producer.close()
        logger.info("Kafka producer closed")


def get_producer() -> KafkaProducer:
    """Get Kafka producer instance"""
    if kafka_producer is None:
        raise RuntimeError("Kafka producer not initialized")
    return kafka_producer


async def publish_log(log_entry: Dict[str, Any]):
    """Publish log entry to Kafka topic"""
    try:
        producer = get_producer()
        log_entry['timestamp'] = datetime.utcnow().isoformat()
        
        future = producer.send(
            settings.KAFKA_LOG_TOPIC,
            value=log_entry,
            key=str(log_entry.get('user_id', 'system')).encode('utf-8')
        )
        
        # Add callback for error handling
        future.add_errback(lambda exc: logger.error(f"Failed to send log: {exc}"))
        
    except Exception as e:
        logger.error(f"Error publishing log to Kafka: {e}")


async def publish_batch_logs(logs: List[Dict[str, Any]]):
    """Publish multiple log entries to Kafka efficiently"""
    try:
        producer = get_producer()
        
        for log_entry in logs:
            log_entry['timestamp'] = datetime.utcnow().isoformat()
            producer.send(
                settings.KAFKA_LOG_TOPIC,
                value=log_entry,
                key=str(log_entry.get('user_id', 'system')).encode('utf-8')
            )
        
        # Flush to ensure all messages are sent
        producer.flush(timeout=10)
        logger.info(f"Published {len(logs)} logs to Kafka")
        
    except Exception as e:
        logger.error(f"Error publishing batch logs to Kafka: {e}")


class KafkaLogConsumer:
    """Consumer for reading logs from Kafka with async callback"""
    
    def __init__(self, on_message_callback = None, group_id: str = "log-processor"):
        self.on_message_callback = on_message_callback
        self.group_id = group_id
        self.running = False
        self.consumer_thread = None
        
    async def start(self):
        """Start consuming messages in background thread"""
        try:
            consumer = KafkaConsumer(
                settings.KAFKA_LOG_TOPIC,
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id=self.group_id,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='latest',  # Start from latest message
                enable_auto_commit=True,
                max_poll_records=settings.KAFKA_BATCH_SIZE,
            )
            
            self.running = True
            self.consumer_thread = threading.Thread(
                target=self._consume_loop,
                args=(consumer,),
                daemon=True
            )
            self.consumer_thread.start()
            logger.info(f"Kafka consumer started for topic {settings.KAFKA_LOG_TOPIC}")
            
        except Exception as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            raise
    
    def _consume_loop(self, consumer):
        """Main consumption loop"""
        try:
            for message in consumer:
                if not self.running:
                    break
                    
                if self.on_message_callback:
                    try:
                        # Non-blocking callback
                        self.on_message_callback(message.value)
                    except Exception as e:
                        logger.error(f"Error in message callback: {e}")
                        
        except Exception as e:
            logger.error(f"Kafka consumer error: {e}")
    
    def stop(self):
        """Stop consumer"""
        self.running = False
        if self.consumer_thread:
            self.consumer_thread.join(timeout=5)
        logger.info("Kafka consumer stopped")
