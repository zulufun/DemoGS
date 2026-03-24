"""Business logic services"""

from .redis_service import (
    init_redis,
    close_redis,
    redis_client,
    get_redis,
    set_cache,
    get_cache,
    delete_cache,
    clear_cache_pattern,
    incr_counter,
    get_counter,
)
from .kafka_service import (
    init_kafka,
    close_kafka,
    kafka_producer,
    KafkaLogConsumer,
    publish_log,
    publish_batch_logs,
)
from .elasticsearch_service import (
    init_elasticsearch_service,
    close_elasticsearch_service,
    get_es_service,
)

__all__ = [
    "init_redis",
    "close_redis",
    "redis_client",
    "get_redis",
    "set_cache",
    "get_cache",
    "delete_cache",
    "clear_cache_pattern",
    "incr_counter",
    "get_counter",
    "init_kafka",
    "close_kafka",
    "kafka_producer",
    "KafkaLogConsumer",
    "publish_log",
    "publish_batch_logs",
    "init_elasticsearch_service",
    "close_elasticsearch_service",
    "get_es_service",
]
