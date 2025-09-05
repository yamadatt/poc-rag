#!/usr/bin/env python3
"""
AWS RAG System Architecture Diagram Generator
Generates an architecture diagram using SVG and converts to PNG
"""

import xml.etree.ElementTree as ET
import subprocess
import os

def create_svg_architecture():
    """Create SVG architecture diagram"""
    
    # SVG setup
    svg = ET.Element('svg', {
        'width': '1600',
        'height': '1200',
        'xmlns': 'http://www.w3.org/2000/svg',
        'xmlns:xlink': 'http://www.w3.org/1999/xlink'
    })
    
    # Background
    bg = ET.SubElement(svg, 'rect', {
        'width': '1600',
        'height': '1200',
        'fill': '#f5f5f5'
    })
    
    # Title
    title = ET.SubElement(svg, 'text', {
        'x': '800',
        'y': '50',
        'font-size': '32',
        'font-weight': 'bold',
        'text-anchor': 'middle',
        'fill': '#232F3E'
    })
    title.text = 'AWS Serverless RAG System Architecture'
    
    subtitle = ET.SubElement(svg, 'text', {
        'x': '800',
        'y': '85',
        'font-size': '18',
        'text-anchor': 'middle',
        'fill': '#666'
    })
    subtitle.text = 'Current Implementation with OpenSearch'
    
    # Define colors
    colors = {
        'client': '#FF9900',
        'api': '#146EB4',
        'lambda': '#F68D11',
        'storage': '#569A31',
        'ai': '#9D5FA6',
        'search': '#005276'
    }
    
    # Client/Frontend Layer
    frontend_group = ET.SubElement(svg, 'g', {'id': 'frontend'})
    frontend_rect = ET.SubElement(frontend_group, 'rect', {
        'x': '100',
        'y': '150',
        'width': '250',
        'height': '100',
        'fill': colors['client'],
        'stroke': '#000',
        'stroke-width': '2',
        'rx': '10'
    })
    frontend_text = ET.SubElement(frontend_group, 'text', {
        'x': '225',
        'y': '190',
        'font-size': '18',
        'font-weight': 'bold',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    frontend_text.text = 'React Frontend'
    frontend_subtext = ET.SubElement(frontend_group, 'text', {
        'x': '225',
        'y': '220',
        'font-size': '14',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    frontend_subtext.text = 'TypeScript + Tailwind CSS'
    
    # API Gateway
    api_group = ET.SubElement(svg, 'g', {'id': 'api-gateway'})
    api_rect = ET.SubElement(api_group, 'rect', {
        'x': '650',
        'y': '150',
        'width': '300',
        'height': '100',
        'fill': colors['api'],
        'stroke': '#000',
        'stroke-width': '2',
        'rx': '10'
    })
    api_text = ET.SubElement(api_group, 'text', {
        'x': '800',
        'y': '190',
        'font-size': '18',
        'font-weight': 'bold',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    api_text.text = 'API Gateway'
    api_subtext = ET.SubElement(api_group, 'text', {
        'x': '800',
        'y': '220',
        'font-size': '14',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    api_subtext.text = 'REST API with CORS'
    
    # Lambda Functions Layer
    lambda_functions = [
        {'name': 'Upload', 'x': 150, 'desc': 'File Upload'},
        {'name': 'Process', 'x': 350, 'desc': 'Text Extract'},
        {'name': 'Query', 'x': 550, 'desc': 'RAG Query'},
        {'name': 'Dashboard', 'x': 750, 'desc': 'Statistics'},
        {'name': 'Status', 'x': 950, 'desc': 'Doc Status'},
        {'name': 'Delete', 'x': 1150, 'desc': 'Doc Delete'}
    ]
    
    for func in lambda_functions:
        func_group = ET.SubElement(svg, 'g', {'id': f'lambda-{func["name"].lower()}'})
        func_rect = ET.SubElement(func_group, 'rect', {
            'x': str(func['x']),
            'y': '350',
            'width': '150',
            'height': '80',
            'fill': colors['lambda'],
            'stroke': '#000',
            'stroke-width': '2',
            'rx': '8'
        })
        func_text = ET.SubElement(func_group, 'text', {
            'x': str(func['x'] + 75),
            'y': '380',
            'font-size': '14',
            'font-weight': 'bold',
            'text-anchor': 'middle',
            'fill': 'white'
        })
        func_text.text = func['name']
        func_desc = ET.SubElement(func_group, 'text', {
            'x': str(func['x'] + 75),
            'y': '405',
            'font-size': '11',
            'text-anchor': 'middle',
            'fill': 'white'
        })
        func_desc.text = func['desc']
    
    # Storage Layer
    # S3 Bucket
    s3_group = ET.SubElement(svg, 'g', {'id': 's3'})
    s3_rect = ET.SubElement(s3_group, 'rect', {
        'x': '100',
        'y': '550',
        'width': '200',
        'height': '100',
        'fill': colors['storage'],
        'stroke': '#000',
        'stroke-width': '2',
        'rx': '10'
    })
    s3_text = ET.SubElement(s3_group, 'text', {
        'x': '200',
        'y': '590',
        'font-size': '16',
        'font-weight': 'bold',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    s3_text.text = 'S3 Bucket'
    s3_desc = ET.SubElement(s3_group, 'text', {
        'x': '200',
        'y': '620',
        'font-size': '12',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    s3_desc.text = 'Document Storage'
    
    # DynamoDB
    dynamo_group = ET.SubElement(svg, 'g', {'id': 'dynamodb'})
    dynamo_rect = ET.SubElement(dynamo_group, 'rect', {
        'x': '350',
        'y': '550',
        'width': '200',
        'height': '100',
        'fill': colors['storage'],
        'stroke': '#000',
        'stroke-width': '2',
        'rx': '10'
    })
    dynamo_text = ET.SubElement(dynamo_group, 'text', {
        'x': '450',
        'y': '590',
        'font-size': '16',
        'font-weight': 'bold',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    dynamo_text.text = 'DynamoDB'
    dynamo_desc = ET.SubElement(dynamo_group, 'text', {
        'x': '450',
        'y': '620',
        'font-size': '12',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    dynamo_desc.text = 'Document Metadata'
    
    # OpenSearch
    opensearch_group = ET.SubElement(svg, 'g', {'id': 'opensearch'})
    opensearch_rect = ET.SubElement(opensearch_group, 'rect', {
        'x': '600',
        'y': '550',
        'width': '300',
        'height': '100',
        'fill': colors['search'],
        'stroke': '#000',
        'stroke-width': '2',
        'rx': '10'
    })
    opensearch_text = ET.SubElement(opensearch_group, 'text', {
        'x': '750',
        'y': '590',
        'font-size': '16',
        'font-weight': 'bold',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    opensearch_text.text = 'OpenSearch Service'
    opensearch_desc = ET.SubElement(opensearch_group, 'text', {
        'x': '750',
        'y': '620',
        'font-size': '12',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    opensearch_desc.text = 'Vector Search (t3.small)'
    
    # CloudWatch
    cloudwatch_group = ET.SubElement(svg, 'g', {'id': 'cloudwatch'})
    cloudwatch_rect = ET.SubElement(cloudwatch_group, 'rect', {
        'x': '950',
        'y': '550',
        'width': '200',
        'height': '100',
        'fill': '#759C3E',
        'stroke': '#000',
        'stroke-width': '2',
        'rx': '10'
    })
    cloudwatch_text = ET.SubElement(cloudwatch_group, 'text', {
        'x': '1050',
        'y': '590',
        'font-size': '16',
        'font-weight': 'bold',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    cloudwatch_text.text = 'CloudWatch'
    cloudwatch_desc = ET.SubElement(cloudwatch_group, 'text', {
        'x': '1050',
        'y': '620',
        'font-size': '12',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    cloudwatch_desc.text = 'Logs & Metrics'
    
    # Bedrock Services
    bedrock_group = ET.SubElement(svg, 'g', {'id': 'bedrock'})
    bedrock_rect = ET.SubElement(bedrock_group, 'rect', {
        'x': '400',
        'y': '750',
        'width': '800',
        'height': '120',
        'fill': colors['ai'],
        'stroke': '#000',
        'stroke-width': '2',
        'rx': '10'
    })
    bedrock_text = ET.SubElement(bedrock_group, 'text', {
        'x': '800',
        'y': '790',
        'font-size': '20',
        'font-weight': 'bold',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    bedrock_text.text = 'Amazon Bedrock'
    
    # Bedrock services
    titan_text = ET.SubElement(bedrock_group, 'text', {
        'x': '600',
        'y': '830',
        'font-size': '14',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    titan_text.text = 'Titan Embeddings V1'
    
    claude_text = ET.SubElement(bedrock_group, 'text', {
        'x': '1000',
        'y': '830',
        'font-size': '14',
        'text-anchor': 'middle',
        'fill': 'white'
    })
    claude_text.text = 'Claude 3 Sonnet'
    
    dimension_text = ET.SubElement(bedrock_group, 'text', {
        'x': '800',
        'y': '855',
        'font-size': '11',
        'text-anchor': 'middle',
        'fill': 'white',
        'font-style': 'italic'
    })
    dimension_text.text = '(1536-dimensional vectors)'
    
    # Connection lines
    def add_arrow(x1, y1, x2, y2, label=''):
        line = ET.SubElement(svg, 'line', {
            'x1': str(x1),
            'y1': str(y1),
            'x2': str(x2),
            'y2': str(y2),
            'stroke': '#333',
            'stroke-width': '2',
            'marker-end': 'url(#arrowhead)'
        })
        if label:
            mid_x = (x1 + x2) / 2
            mid_y = (y1 + y2) / 2
            label_bg = ET.SubElement(svg, 'rect', {
                'x': str(mid_x - 40),
                'y': str(mid_y - 10),
                'width': '80',
                'height': '20',
                'fill': 'white',
                'stroke': '#333',
                'stroke-width': '1',
                'rx': '3'
            })
            label_text = ET.SubElement(svg, 'text', {
                'x': str(mid_x),
                'y': str(mid_y + 5),
                'font-size': '10',
                'text-anchor': 'middle',
                'fill': '#333'
            })
            label_text.text = label
    
    # Define arrow marker
    defs = ET.SubElement(svg, 'defs')
    marker = ET.SubElement(defs, 'marker', {
        'id': 'arrowhead',
        'markerWidth': '10',
        'markerHeight': '7',
        'refX': '10',
        'refY': '3.5',
        'orient': 'auto'
    })
    polygon = ET.SubElement(marker, 'polygon', {
        'points': '0 0, 10 3.5, 0 7',
        'fill': '#333'
    })
    
    # Add connections
    # Frontend to API Gateway
    add_arrow(350, 200, 650, 200, 'HTTPS')
    
    # API Gateway to Lambda functions
    add_arrow(800, 250, 225, 350)
    add_arrow(800, 250, 425, 350)
    add_arrow(800, 250, 625, 350)
    add_arrow(800, 250, 825, 350)
    add_arrow(800, 250, 1025, 350)
    add_arrow(800, 250, 1225, 350)
    
    # Lambda to Storage connections
    # Upload to S3
    add_arrow(225, 430, 200, 550)
    # Process to S3, DynamoDB, OpenSearch
    add_arrow(425, 430, 200, 550)
    add_arrow(425, 430, 450, 550)
    add_arrow(425, 430, 750, 550)
    # Query to OpenSearch
    add_arrow(625, 430, 750, 550)
    # Dashboard to S3, OpenSearch
    add_arrow(825, 430, 200, 550)
    add_arrow(825, 430, 750, 550)
    # Status to OpenSearch
    add_arrow(1025, 430, 750, 550)
    # Delete to S3, DynamoDB
    add_arrow(1225, 430, 200, 550)
    add_arrow(1225, 430, 450, 550)
    
    # Lambda to CloudWatch
    add_arrow(825, 430, 1050, 550)
    
    # Lambda to Bedrock
    add_arrow(425, 430, 600, 750)
    add_arrow(625, 430, 1000, 750)
    
    # Key Features Box
    features_group = ET.SubElement(svg, 'g', {'id': 'features'})
    features_rect = ET.SubElement(features_group, 'rect', {
        'x': '50',
        'y': '950',
        'width': '1500',
        'height': '180',
        'fill': 'white',
        'stroke': '#333',
        'stroke-width': '2',
        'rx': '10'
    })
    
    features_title = ET.SubElement(features_group, 'text', {
        'x': '800',
        'y': '980',
        'font-size': '18',
        'font-weight': 'bold',
        'text-anchor': 'middle',
        'fill': '#232F3E'
    })
    features_title.text = 'System Specifications'
    
    # Feature columns
    features_data = [
        ('Lambda Functions', ['6 Functions (Go)', 'provided.al2023 runtime', '512MB Memory', '30s-300s Timeout'], 200),
        ('Storage', ['S3 with Versioning', 'DynamoDB Pay-per-request', 'CloudWatch 14-day retention'], 500),
        ('Search', ['OpenSearch 2.3', 't3.small instance', '10GB gp3 storage', 'KNN Vector Search'], 800),
        ('AI/ML', ['Titan Embeddings V1', 'Claude 3 Sonnet', '1536-dim vectors', 'RAG Generation'], 1100),
        ('API', ['REST API', 'CORS Enabled', 'OpenAPI 3.0.1', 'Multiple Endpoints'], 1400)
    ]
    
    for title, items, x in features_data:
        col_title = ET.SubElement(features_group, 'text', {
            'x': str(x),
            'y': '1010',
            'font-size': '14',
            'font-weight': 'bold',
            'text-anchor': 'middle',
            'fill': '#146EB4'
        })
        col_title.text = title
        
        for i, item in enumerate(items):
            item_text = ET.SubElement(features_group, 'text', {
                'x': str(x),
                'y': str(1035 + i * 20),
                'font-size': '11',
                'text-anchor': 'middle',
                'fill': '#333'
            })
            item_text.text = f'• {item}'
    
    return ET.tostring(svg, encoding='unicode')

# Generate SVG
svg_content = create_svg_architecture()

# Save SVG file
with open('aws-architecture.svg', 'w') as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
    f.write(svg_content)

print("SVG architecture diagram created: aws-architecture.svg")

# Try to convert to PNG using different methods
conversion_successful = False

# Method 1: Try using rsvg-convert
try:
    subprocess.run(['rsvg-convert', '-f', 'png', '-o', 'aws-architecture.png', 'aws-architecture.svg'], check=True)
    print("PNG created using rsvg-convert: aws-architecture.png")
    conversion_successful = True
except (subprocess.CalledProcessError, FileNotFoundError):
    pass

# Method 2: Try using inkscape
if not conversion_successful:
    try:
        subprocess.run(['inkscape', 'aws-architecture.svg', '--export-type=png', '--export-filename=aws-architecture.png'], check=True)
        print("PNG created using Inkscape: aws-architecture.png")
        conversion_successful = True
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

# Method 3: Try using convert (ImageMagick)
if not conversion_successful:
    try:
        subprocess.run(['convert', 'aws-architecture.svg', 'aws-architecture.png'], check=True)
        print("PNG created using ImageMagick: aws-architecture.png")
        conversion_successful = True
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

if not conversion_successful:
    print("\nNote: To convert SVG to PNG, you need one of these tools installed:")
    print("  - rsvg-convert (sudo apt-get install librsvg2-bin)")
    print("  - inkscape (sudo apt-get install inkscape)")
    print("  - convert (sudo apt-get install imagemagick)")
    print("\nThe SVG file has been created and can be viewed in a web browser.")