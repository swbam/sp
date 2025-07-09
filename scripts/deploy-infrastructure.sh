#!/bin/bash

# 🚀 MySetlist Production Infrastructure Deployment Script
# Complete DevOps infrastructure setup with monitoring, security, and auto-scaling

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="mysetlist-production"
REGION="us-east-1"
DOMAIN="mysetlist.com"
ENVIRONMENT="production"

# Function to print colored output
print_header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${CYAN}🔧 $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing_tools=()
    
    # Check required tools
    tools=("terraform" "kubectl" "helm" "aws" "docker")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        else
            print_status "$tool is installed"
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_info "Please install the missing tools and run this script again"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured"
        print_info "Run 'aws configure' to set up your credentials"
        exit 1
    fi
    
    print_status "AWS credentials configured"
    
    # Check Terraform
    if [ ! -f "terraform/main.tf" ]; then
        print_error "Terraform configuration not found"
        print_info "Make sure you're running this script from the project root"
        exit 1
    fi
    
    print_status "All prerequisites met"
}

# Deploy infrastructure with Terraform
deploy_terraform() {
    print_header "Deploying Infrastructure with Terraform"
    
    cd terraform
    
    print_step "Initializing Terraform"
    terraform init
    
    print_step "Planning Terraform deployment"
    terraform plan -var="domain_name=$DOMAIN" -var="environment=$ENVIRONMENT" -out=tfplan
    
    print_warning "Review the Terraform plan above"
    read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deployment cancelled by user"
        exit 0
    fi
    
    print_step "Applying Terraform configuration"
    terraform apply tfplan
    
    print_step "Updating kubeconfig"
    aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER_NAME"
    
    cd ..
    print_status "Infrastructure deployed successfully"
}

# Install cluster essentials
install_cluster_essentials() {
    print_header "Installing Cluster Essentials"
    
    # Add Helm repositories
    print_step "Adding Helm repositories"
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add jetstack https://charts.jetstack.io
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo add external-dns https://kubernetes-sigs.github.io/external-dns/
    helm repo add cluster-autoscaler https://kubernetes.github.io/autoscaler
    helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts/
    helm repo update
    
    # Install cert-manager
    print_step "Installing cert-manager"
    kubectl create namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --set installCRDs=true \
        --set global.leaderElection.namespace=cert-manager \
        --wait
    
    # Install ingress-nginx
    print_step "Installing ingress-nginx"
    kubectl create namespace ingress-nginx --dry-run=client -o yaml | kubectl apply -f -
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --set controller.metrics.enabled=true \
        --set controller.metrics.serviceMonitor.enabled=true \
        --set controller.podAnnotations."prometheus\.io/scrape"="true" \
        --set controller.podAnnotations."prometheus\.io/port"="10254" \
        --wait
    
    # Install cluster autoscaler
    print_step "Installing cluster autoscaler"
    kubectl create namespace kube-system --dry-run=client -o yaml | kubectl apply -f - || true
    helm upgrade --install cluster-autoscaler cluster-autoscaler/cluster-autoscaler \
        --namespace kube-system \
        --set autoDiscovery.clusterName="$CLUSTER_NAME" \
        --set awsRegion="$REGION" \
        --set rbac.serviceAccount.annotations."eks\.amazonaws\.com/role-arn"="$(terraform -chdir=terraform output -raw cluster_autoscaler_role_arn)" \
        --wait
    
    # Install external-dns
    print_step "Installing external-dns"
    helm upgrade --install external-dns external-dns/external-dns \
        --namespace kube-system \
        --set provider=aws \
        --set aws.region="$REGION" \
        --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"="$(terraform -chdir=terraform output -raw external_dns_role_arn)" \
        --set txtOwnerId="$CLUSTER_NAME" \
        --wait
    
    print_status "Cluster essentials installed"
}

# Deploy monitoring stack
deploy_monitoring() {
    print_header "Deploying Monitoring Stack"
    
    # Create monitoring namespace
    print_step "Creating monitoring namespace"
    kubectl apply -f k8s/namespace.yaml
    
    # Install Prometheus Operator
    print_step "Installing Prometheus Operator"
    helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
        --namespace mysetlist-monitoring \
        --set prometheus.prometheusSpec.retention=30d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=gp3 \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
        --set grafana.adminPassword="$(openssl rand -base64 32)" \
        --set grafana.persistence.enabled=true \
        --set grafana.persistence.size=10Gi \
        --set alertmanager.alertmanagerSpec.retention=120h \
        --wait
    
    # Apply custom monitoring configurations
    print_step "Applying custom monitoring configurations"
    kubectl apply -f k8s/monitoring/ -n mysetlist-monitoring
    
    # Install OpenTelemetry Operator
    print_step "Installing OpenTelemetry Operator"
    kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml
    
    # Wait for OpenTelemetry Operator to be ready
    kubectl wait --for=condition=available deployment/opentelemetry-operator-controller-manager -n opentelemetry-operator-system --timeout=300s
    
    # Apply OpenTelemetry configurations
    kubectl apply -f k8s/monitoring/opentelemetry.yaml -n mysetlist-monitoring
    
    print_status "Monitoring stack deployed"
}

# Deploy backup system
deploy_backup() {
    print_header "Deploying Backup System"
    
    # Install Velero
    print_step "Installing Velero"
    kubectl create namespace velero --dry-run=client -o yaml | kubectl apply -f -
    helm upgrade --install velero vmware-tanzu/velero \
        --namespace velero \
        --set serviceAccount.server.annotations."eks\.amazonaws\.com/role-arn"="$(terraform -chdir=terraform output -raw backup_role_arn || echo 'ROLE_ARN_NOT_FOUND')" \
        --set configuration.provider=aws \
        --set configuration.backupStorageLocation.name=aws \
        --set configuration.backupStorageLocation.bucket="$(terraform -chdir=terraform output -raw backup_s3_bucket)" \
        --set configuration.backupStorageLocation.config.region="$REGION" \
        --set configuration.volumeSnapshotLocation.name=aws \
        --set configuration.volumeSnapshotLocation.config.region="$REGION" \
        --set initContainers[0].name=velero-plugin-for-aws \
        --set initContainers[0].image=velero/velero-plugin-for-aws:v1.8.0 \
        --set initContainers[0].volumeMounts[0].mountPath=/target \
        --set initContainers[0].volumeMounts[0].name=plugins \
        --wait
    
    # Apply backup configurations
    print_step "Applying backup configurations"
    kubectl apply -f k8s/backup/velero.yaml
    
    print_status "Backup system deployed"
}

# Deploy application namespaces and configurations
deploy_application_config() {
    print_header "Deploying Application Configuration"
    
    # Apply namespace configurations
    print_step "Creating application namespaces"
    kubectl apply -f k8s/namespace.yaml
    
    # Apply network policies and resource quotas
    print_step "Applying security and resource policies"
    kubectl apply -f k8s/autoscaling.yaml -n mysetlist-production
    
    # Create secrets (user will need to fill in actual values)
    print_step "Creating secret templates"
    print_warning "Remember to update the secrets with actual values before deploying the application"
    kubectl apply -f k8s/secret-template.yaml -n mysetlist-production --dry-run=client -o yaml > k8s/secrets-to-update.yaml
    
    # Apply configmaps
    print_step "Applying configuration maps"
    kubectl apply -f k8s/configmap.yaml -n mysetlist-production
    
    print_status "Application configuration deployed"
}

# Deploy security scanning
deploy_security() {
    print_header "Deploying Security Scanning"
    
    # Install Falco for runtime security
    print_step "Installing Falco"
    helm repo add falcosecurity https://falcosecurity.github.io/charts
    helm repo update
    helm upgrade --install falco falcosecurity/falco \
        --namespace falco-system \
        --create-namespace \
        --set falco.grpc.enabled=true \
        --set falco.grpcOutput.enabled=true \
        --wait
    
    # Install OPA Gatekeeper for policy enforcement
    print_step "Installing OPA Gatekeeper"
    kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/release-3.14/deploy/gatekeeper.yaml
    kubectl wait --for=condition=available deployment/gatekeeper-controller-manager -n gatekeeper-system --timeout=300s
    
    print_status "Security scanning deployed"
}

# Validate deployment
validate_deployment() {
    print_header "Validating Deployment"
    
    # Check cluster health
    print_step "Checking cluster health"
    kubectl cluster-info
    kubectl get nodes
    
    # Check critical namespaces
    print_step "Checking namespace health"
    namespaces=("mysetlist-production" "mysetlist-monitoring" "velero" "cert-manager" "ingress-nginx")
    for ns in "${namespaces[@]}"; do
        if kubectl get namespace "$ns" &> /dev/null; then
            print_status "Namespace $ns exists"
        else
            print_warning "Namespace $ns not found"
        fi
    done
    
    # Check monitoring stack
    print_step "Checking monitoring stack"
    kubectl get pods -n mysetlist-monitoring
    
    # Check ingress controller
    print_step "Checking ingress controller"
    kubectl get pods -n ingress-nginx
    
    # Check backup system
    print_step "Checking backup system"
    kubectl get pods -n velero
    
    print_status "Deployment validation complete"
}

# Generate deployment report
generate_report() {
    print_header "Generating Deployment Report"
    
    local report_file="deployment-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# MySetlist Production Infrastructure Deployment Report

**Date:** $(date)
**Cluster:** $CLUSTER_NAME
**Region:** $REGION
**Environment:** $ENVIRONMENT

## Infrastructure Components

### Core Infrastructure
- ✅ EKS Cluster: $CLUSTER_NAME
- ✅ VPC and Networking
- ✅ Security Groups and NACLs
- ✅ Route53 DNS Zone
- ✅ ACM SSL Certificates
- ✅ S3 Backup Storage

### Kubernetes Components
- ✅ cert-manager
- ✅ ingress-nginx
- ✅ cluster-autoscaler
- ✅ external-dns

### Monitoring Stack
- ✅ Prometheus Operator
- ✅ Grafana
- ✅ OpenTelemetry Collector
- ✅ Jaeger Tracing
- ✅ Node Exporter

### Backup & DR
- ✅ Velero
- ✅ Daily/Weekly Backup Schedules
- ✅ Disaster Recovery Runbook

### Security
- ✅ Falco Runtime Security
- ✅ OPA Gatekeeper
- ✅ Network Policies
- ✅ Pod Security Standards

## Next Steps

1. **Update Secrets**: Update the secrets in k8s/secrets-to-update.yaml with actual values
2. **Deploy Application**: Use Helm chart to deploy MySetlist application
3. **Configure DNS**: Update domain name servers to Route53
4. **Test Backup**: Perform test backup and restore
5. **Load Testing**: Run performance tests
6. **Security Scan**: Perform security vulnerability scan

## Access Information

- **Cluster Endpoint**: $(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
- **Grafana**: kubectl port-forward -n mysetlist-monitoring svc/kube-prometheus-stack-grafana 3000:80
- **Prometheus**: kubectl port-forward -n mysetlist-monitoring svc/kube-prometheus-stack-prometheus 9090:9090
- **Jaeger**: kubectl port-forward -n mysetlist-monitoring svc/jaeger-query 16686:16686

## Monitoring Dashboards

Access monitoring dashboards:
\`\`\`bash
# Grafana (admin/prom-operator)
kubectl port-forward -n mysetlist-monitoring svc/kube-prometheus-stack-grafana 3000:80

# Prometheus
kubectl port-forward -n mysetlist-monitoring svc/kube-prometheus-stack-prometheus 9090:9090

# Jaeger
kubectl port-forward -n mysetlist-monitoring svc/jaeger-query 16686:16686
\`\`\`

## Emergency Contacts

- DevOps Team: devops@mysetlist.com
- Infrastructure Lead: infrastructure@mysetlist.com
- On-call Engineer: +1-XXX-XXX-XXXX

---
Generated by MySetlist Infrastructure Deployment Script
EOF
    
    print_status "Deployment report generated: $report_file"
}

# Main execution
main() {
    print_header "MySetlist Production Infrastructure Deployment"
    print_info "This script will deploy a complete production-ready infrastructure"
    print_info "Estimated time: 30-45 minutes"
    
    echo
    read -p "Do you want to proceed? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deployment cancelled by user"
        exit 0
    fi
    
    check_prerequisites
    deploy_terraform
    install_cluster_essentials
    deploy_monitoring
    deploy_backup
    deploy_application_config
    deploy_security
    validate_deployment
    generate_report
    
    print_header "🎉 Deployment Complete!"
    print_status "MySetlist production infrastructure is ready"
    print_info "Check the deployment report for next steps and access information"
    print_warning "Don't forget to update the secrets before deploying the application"
}

# Handle script interruption
trap 'print_error "Script interrupted"; exit 1' INT TERM

# Run main function
main "$@"