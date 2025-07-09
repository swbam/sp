# Variables for MySetlist Infrastructure

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "mysetlist.com"
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "mysetlist-production"
}

variable "node_group_desired_capacity" {
  description = "Desired capacity of the node group"
  type        = number
  default     = 6
}

variable "node_group_max_capacity" {
  description = "Maximum capacity of the node group"
  type        = number
  default     = 20
}

variable "node_group_min_capacity" {
  description = "Minimum capacity of the node group"
  type        = number
  default     = 3
}

variable "node_instance_types" {
  description = "Instance types for the node group"
  type        = list(string)
  default     = ["m5.large", "m5a.large", "m5d.large"]
}

variable "enable_monitoring" {
  description = "Enable monitoring stack"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable logging stack"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}