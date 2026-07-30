import { readFileSync, writeFileSync } from 'node:fs';

const p = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(p, 'utf8');
const steps = [];
function edit(label, from, to) {
  if (!h.includes(from)) throw new Error(`anchor not found: ${label}`);
  h = h.replace(from, to);
  steps.push(`ok  ${label}`);
}

// ═══════ Sprint 07: the NAT decision as its own section ═══════
edit('nat section',
  '  <h2><span class="h2n">§2</span>Fundamentals: containers on AWS</h2>',
  `  <h2><span class="h2n">§1c</span>The NAT question: gateway, instance, or neither</h2>
  <p>NAT Gateway is the largest fixed cost in this architecture, ahead of the database. Before accepting roughly $66 a month for two AZs, work through three questions in order. The first one is the cheapest to answer and the one people skip.</p>

  <h3>Question 1: does anything actually need egress?</h3>
  <p>List what in this system talks outbound from a private subnet, and what each thing could use instead:</p>
  <div class="tw">
  <table>
    <thead><tr><th>Caller wants</th><th>Needs the internet?</th><th>Alternative</th></tr></thead>
    <tbody>
      <tr><td>Pull a container image from ECR</td><td>No</td><td>Interface endpoints for <code>ecr.api</code> and <code>ecr.dkr</code>, plus the free S3 gateway endpoint, because image layers live in S3</td></tr>
      <tr><td>Read a database password</td><td>No</td><td><code>secretsmanager</code> interface endpoint</td></tr>
      <tr><td>Write logs and metrics</td><td>No</td><td><code>logs</code> and <code>monitoring</code> endpoints</td></tr>
      <tr><td>Put and get S3 objects</td><td>No</td><td>Gateway endpoint, free</td></tr>
      <tr><td>Call Textract, Bedrock, SQS, SNS, KMS, STS</td><td>No</td><td>All have interface endpoints</td></tr>
      <tr><td>Reach a customer's webhook or a third-party API</td><td><b>Yes</b></td><td>Nothing. This is what NAT is for.</td></tr>
      <tr><td><code>apt</code> or <code>npm install</code> at runtime</td><td>Yes, and it should not be happening</td><td>Bake dependencies at build time in CI</td></tr>
    </tbody>
  </table>
  </div>
  <p>Every AWS call this platform makes can go through an endpoint. So a private subnet with a complete endpoint set may need <b>no egress at all</b>, and the cheapest NAT is the one you do not create. Verify rather than assume: point VPC Flow Logs at the NAT's interface with <code>ACCEPT</code> for a day and read what is actually leaving. Most people are surprised.</p>
  <div class="note">
    <span class="tag">The catch with going NAT-less</span>
    <p>Interface endpoints are not free either, at roughly $7.30 a month per endpoint per AZ. Six endpoints across two AZs is about $88, which is <em>more</em> than the NAT Gateways you removed. Endpoints win on data processing charges and on keeping traffic off the public internet, not automatically on the hourly line. Count both before declaring victory.</p>
  </div>

  <h3>Question 2: managed gateway, or an instance you run?</h3>
  <p>A NAT Gateway is a managed service. A NAT instance is an EC2 box with IP forwarding and an iptables masquerade rule, which is all NAT actually is. AWS used to publish a NAT AMI and quietly stopped maintaining it, which is the gap <b>fck-nat</b> fills: a small, current, purpose-built AMI that does nothing but this job.</p>

  <div class="tw">
  <table>
    <thead><tr><th></th><th>NAT Gateway</th><th>fck-nat instance</th></tr></thead>
    <tbody>
      <tr><th>Cost per AZ</th><td>~$32/mo + $0.045 per GB processed</td><td><b>~$3/mo</b> on a <code>t4g.nano</code>, plus ~$3.60/mo for the public IPv4 address. No per-GB processing charge.</td></tr>
      <tr><th>Two AZs, before traffic</th><td>~$66/mo</td><td><b>~$13/mo</b></td></tr>
      <tr><th>Throughput</th><td>Scales to 100 Gbps with no action</td><td>Bounded by instance type. A <code>t4g.nano</code> has a low baseline with burst credits, so sustained transfer collapses once credits run out.</td></tr>
      <tr><th>Availability</th><td>Redundant inside its AZ, managed</td><td>One instance. An Auto Scaling group replaces it in one to three minutes.</td></tr>
      <tr><th>Failover behaviour</th><td>Transparent</td><td>NAT is stateful, so every in-flight TCP connection breaks on replacement.</td></tr>
      <tr><th>Patching</th><td>AWS</td><td>You. Refresh the AMI, or cycle instances on a schedule.</td></tr>
      <tr><th>Security group</th><td>Cannot have one</td><td>Can, and should. You get an egress control point a gateway does not give you.</td></tr>
      <tr><th>Connection limits</th><td>55,000 per unique destination; watch <code>ErrorPortAllocation</code></td><td>Kernel conntrack table. Tune <code>net.netfilter.nf_conntrack_max</code> before you need to.</td></tr>
      <tr><th>Monitoring</th><td>Metrics out of the box</td><td>You add them: CPU, network throughput, and the burst credit balance</td></tr>
    </tbody>
  </table>
  </div>

  <p>The saving is around $53 a month, or $636 a year, for two AZs. For a portfolio project running on your own money that is the difference between leaving the environment up and tearing it down after every session, which has its own value: infrastructure you can afford to leave running is infrastructure you will actually keep using.</p>

  <h3>Wiring fck-nat in Terraform</h3>
  <p>The network module gains a <code>nat_mode</code> variable so an environment picks its own answer. Dev runs an instance, prod runs gateways, and the route tables do not care which.</p>

  <div class="code">
    <div class="code-top"><span>HCL</span><span class="path">infra/modules/network/variables.tf</span><button class="copy" type="button">Copy</button></div>
<pre><code>variable "nat_mode" {
  type        = string
  default     = "gateway"
  description = "gateway = managed NAT Gateway, instance = fck-nat, none = no egress"

  validation {
    condition     = contains(["gateway", "instance", "none"], var.nat_mode)
    error_message = "nat_mode must be gateway, instance or none."
  }
}

variable "nat_instance_type" {
  type    = string
  # t4g.nano is fine when the bulk of traffic goes through VPC endpoints.
  # Move to t4g.small before you rely on sustained throughput: the nano's
  # network baseline is low and it burns burst credits to exceed it.
  default = "t4g.nano"
}</code></pre>
  </div>

  <div class="code">
    <div class="code-top"><span>HCL</span><span class="path">infra/modules/network/nat-instance.tf</span><button class="copy" type="button">Copy</button></div>
<pre><code>locals {
  use_instance = var.nat_mode == "instance"
  use_gateway  = var.nat_mode == "gateway"
  # One NAT per AZ in prod, one shared in dev, whichever mode is in play.
  nat_count = var.single_nat_gateway ? 1 : length(local.azs)
}

# The published fck-nat AMI. Verify the owner id and name pattern against the
# project's current release notes before trusting this: a wrong owner silently
# selects nothing and the plan fails with an unhelpful message.
data "aws_ami" "fck_nat" {
  count       = local.use_instance ? 1 : 0
  most_recent = true
  owners      = [var.fck_nat_ami_owner]

  filter {
    name   = "name"
    values = ["fck-nat-amzn2-*"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

# ── The persistent ENI ────────────────────────────────────────────────
# This is the part that makes an instance-based NAT survivable. The route
# table points at an ENI, not at an instance. The Auto Scaling group can
# destroy and recreate the instance underneath, and as long as the new one
# attaches this same ENI, the route keeps working. Without it, a replacement
# leaves a black-hole route and every private subnet loses egress until
# something updates the route table.
resource "aws_network_interface" "nat" {
  count     = local.use_instance ? local.nat_count : 0
  subnet_id = aws_subnet.public[count.index].id

  security_groups = [aws_security_group.nat_instance[0].id]

  # THE classic mistake. An EC2 instance drops any packet whose destination is
  # not itself, which is exactly what a router spends all day doing. Leave this
  # on and you get a NAT that answers pings and forwards nothing, with no error
  # anywhere to tell you why.
  source_dest_check = false

  tags = {
    Name = "\${local.name}-nat-\${count.index}"
  }
}

resource "aws_eip" "nat_instance" {
  count             = local.use_instance ? local.nat_count : 0
  domain            = "vpc"
  network_interface = aws_network_interface.nat[count.index].id
}

resource "aws_security_group" "nat_instance" {
  count       = local.use_instance ? 1 : 0
  name        = "\${local.name}-nat"
  description = "fck-nat: forward traffic from private subnets"
  vpc_id      = aws_vpc.main.id

  # Only our own VPC may route through it. A NAT Gateway cannot be restricted
  # like this at all, so the instance is the stricter option here.
  ingress {
    description = "Any traffic originating inside the VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Session Manager only. No SSH key, no port 22 in the security group above.
resource "aws_iam_role" "nat_instance" {
  count = local.use_instance ? 1 : 0
  name  = "\${local.name}-nat"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "nat_ssm" {
  count      = local.use_instance ? 1 : 0
  role       = aws_iam_role.nat_instance[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# The instance attaches the ENI to itself at boot, so it needs permission to
# do that. Scoped to attach and describe: it cannot create or delete ENIs.
resource "aws_iam_role_policy" "nat_eni" {
  count = local.use_instance ? 1 : 0
  role  = aws_iam_role.nat_instance[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ec2:AttachNetworkInterface",
        "ec2:ModifyNetworkInterfaceAttribute",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeAddresses",
        "ec2:AssociateAddress",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_instance_profile" "nat_instance" {
  count = local.use_instance ? 1 : 0
  name  = "\${local.name}-nat"
  role  = aws_iam_role.nat_instance[0].name
}

resource "aws_launch_template" "nat" {
  count         = local.use_instance ? local.nat_count : 0
  name_prefix   = "\${local.name}-nat-\${count.index}-"
  image_id      = data.aws_ami.fck_nat[0].id
  instance_type = var.nat_instance_type

  iam_instance_profile {
    arn = aws_iam_instance_profile.nat_instance[0].arn
  }

  # The AMI reads this file on boot and attaches the ENI named in it. Confirm
  # the key names against the project README for the version you pin; they are
  # the one part of this that has changed between releases.
  user_data = base64encode(&lt;&lt;-EOT
    #!/bin/bash
    echo "eni_id=\${aws_network_interface.nat[count.index].id}" &gt; /etc/fck-nat.conf
    # Raise the connection tracking table before a busy pipeline needs it.
    # The default is sized for a workstation, not a router.
    echo "net.netfilter.nf_conntrack_max=131072" &gt;&gt; /etc/sysctl.d/99-nat.conf
    sysctl --system
    systemctl restart fck-nat
  EOT
  )

  metadata_options {
    http_tokens = "required"   # IMDSv2 only
  }

  monitoring {
    enabled = true
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "\${local.name}-nat-\${count.index}"
    }
  }
}

# An ASG of exactly one, per AZ. This is the whole availability story: the
# group notices a failed health check and launches a replacement, which
# reattaches the ENI and restores egress.
resource "aws_autoscaling_group" "nat" {
  count               = local.use_instance ? local.nat_count : 0
  name                = "\${local.name}-nat-\${count.index}"
  min_size            = 1
  max_size            = 1
  desired_capacity    = 1
  vpc_zone_identifier = [aws_subnet.public[count.index].id]

  launch_template {
    id      = aws_launch_template.nat[count.index].id
    version = "$Latest"
  }

  # Replace on a new AMI rather than waiting for something to fail.
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 0   # one instance: it must go down to come back
    }
  }

  tag {
    key                 = "Name"
    value               = "\${local.name}-nat-\${count.index}"
    propagate_at_launch = true
  }
}

# ── Routes. Same destination, different target per mode. ──────────────
resource "aws_route" "app_egress" {
  count = var.nat_mode == "none" ? 0 : length(local.azs)

  route_table_id         = aws_route_table.app[count.index].id
  destination_cidr_block = "0.0.0.0/0"

  # A gateway route targets the gateway; an instance route targets the ENI.
  nat_gateway_id = local.use_gateway ? (
    var.single_nat_gateway ? aws_nat_gateway.main[0].id : aws_nat_gateway.main[count.index].id
  ) : null

  network_interface_id = local.use_instance ? (
    var.single_nat_gateway ? aws_network_interface.nat[0].id : aws_network_interface.nat[count.index].id
  ) : null
}</code></pre>
  </div>

  <div class="note warn">
    <span class="tag">The four ways this goes wrong</span>
    <ol style="margin:.35rem 0 0">
      <li><b><code>source_dest_check</code> left enabled.</b> Instances drop packets not addressed to them. Your NAT will boot, pass its health check, answer SSM, and forward nothing. No log anywhere says why.</li>
      <li><b>Burst credits.</b> <code>t4g</code> and <code>t3</code> network throughput is burstable. A large backfill runs fast for a few minutes and then throughput falls off a cliff. Alarm on the credit balance, or use a non-burstable instance family for anything sustained.</li>
      <li><b>The route targets an instance rather than an ENI.</b> Then an ASG replacement leaves a route pointing at a terminated instance, which is a black hole rather than an error.</li>
      <li><b>Conntrack exhaustion.</b> Thousands of concurrent connections fill the kernel's tracking table and new connections are dropped silently. Raise <code>nf_conntrack_max</code> in advance.</li>
    </ol>
  </div>

  <div class="note">
    <span class="tag">There is a module for this</span>
    <p>The community <code>RaJiska/fck-nat/aws</code> module wraps the resources above, including the AMI lookup and route table updates, and is the sensible choice for real use. The long form is here because a NAT instance is a thing worth being able to read: it is an EC2 box, an ENI with one checkbox turned off, and a route. Check the module's own variable names against its documentation rather than copying them from memory.</p>
  </div>

  <h3>Question 3: how much availability do you actually need?</h3>
  <p>The honest comparison is not "managed is more reliable". It is what a failure costs you in this specific system.</p>
  <p>When a fck-nat instance is replaced, every TCP connection through it breaks and egress stops for one to three minutes. Ask what is on the other end. In this platform the answer is reassuring: the workers reach AWS services through VPC endpoints, so they are not affected at all, and anything that does fail is an SQS-driven job that retries. The user-facing API path does not use NAT, because the ALB is in public subnets and the database is local. So a NAT outage in this architecture delays background processing by a couple of minutes and nothing else.</p>
  <p>Change the architecture and the answer changes. A synchronous request path that calls a third-party API on every user action would feel a NAT replacement as a visible outage, and there the gateway earns its money.</p>

  <div class="tw">
  <table>
    <thead><tr><th>Environment</th><th>Choice</th><th>Reasoning</th></tr></thead>
    <tbody>
      <tr><td>dev</td><td><code>nat_mode = "instance"</code>, single AZ</td><td>~$7/mo against ~$33. An outage affects nobody.</td></tr>
      <tr><td>staging</td><td><code>nat_mode = "instance"</code>, one per AZ</td><td>Exercises the same failure modes as prod at a tenth of the cost.</td></tr>
      <tr><td>prod</td><td><code>nat_mode = "gateway"</code></td><td>Not because the instance could not cope, but because I would rather not own kernel tuning and AMI patching on the egress path. That is a preference about where to spend attention, and I would defend the instance choice for a cost-sensitive deployment.</td></tr>
    </tbody>
  </table>
  </div>

  <h2><span class="h2n">§2</span>Fundamentals: containers on AWS</h2>`);

// Sprint 07 trade-off table gains a NAT row
edit('sprint 7 trade-off row',
  `      <tr><td>Secret delivery</td><td>ECS <code>secrets</code> block, injected by the agent</td>`,
  `      <tr><td>Egress</td><td>NAT Gateway in prod, fck-nat instance in dev and staging</td><td>Gateway everywhere; instance everywhere; no NAT at all</td><td>The instance saves about $53 a month per two AZs and gives you a security group on the egress path, at the cost of owning patching and burst-credit behaviour. Prod keeps the gateway because I would rather not own kernel tuning where traffic leaves. Going NAT-less is possible here since every AWS call has an endpoint, but six interface endpoints across two AZs cost more than the gateways they replace.</td></tr>
      <tr><td>Secret delivery</td><td>ECS <code>secrets</code> block, injected by the agent</td>`);

// Sprint 07 DoD
edit('sprint 7 dod',
  `    <li><label><input type="checkbox"><span>I can name the difference between the task role and the execution role from memory</span></label></li>`,
  `    <li><label><input type="checkbox"><span><code>nat_mode</code> switches between gateway, instance and none without touching route table code</span></label></li>
    <li><label><input type="checkbox"><span>NAT instance ENI has <code>source_dest_check = false</code> and the route targets the ENI, not the instance</span></label></li>
    <li><label><input type="checkbox"><span>Terminating the NAT instance restores egress within three minutes with no manual step</span></label></li>
    <li><label><input type="checkbox"><span>Flow logs reviewed to confirm what actually needs egress</span></label></li>
    <li><label><input type="checkbox"><span>I can name the difference between the task role and the execution role from memory</span></label></li>`);

// Sprint 00 cost landmine: point at the fourth option
edit('sprint 0 nat note',
  `Two AZs of NAT is ~$65/month before any traffic — likely the biggest line on your bill. Sprint 07 shows three ways out: a single shared NAT for dev, <b>VPC endpoints</b> so S3/ECR/Secrets traffic never leaves AWS, or destroying the environment when you're not demoing.`,
  `Two AZs of NAT is ~$65/month before any traffic, likely the biggest line on your bill. Sprint 07 works through four ways out: a single shared NAT for dev, <b>VPC endpoints</b> so S3, ECR and Secrets traffic never leaves AWS, a <b>fck-nat instance</b> at around $7 a month instead of $33, or destroying the environment when you are not demoing.`);

// Sprint 11 cost table: alternative line
edit('sprint 11 cost row',
  `      <tr><td>NAT Gateway</td><td>1 dev / 2 prod</td><td class="num">$33</td><td class="num">$66</td><td>Largest fixed cost. Endpoints reduce the data charge, not the hourly one.</td></tr>`,
  `      <tr><td>NAT Gateway</td><td>1 dev / 2 prod</td><td class="num">$33</td><td class="num">$66</td><td>Largest fixed cost. Endpoints reduce the data charge, not the hourly one.</td></tr>
      <tr><td>↳ fck-nat instead</td><td><code>t4g.nano</code> + IPv4</td><td class="num">$7</td><td class="num">$13</td><td>Saves ~$53/mo for two AZs. See Sprint 07 §1c for what you take on.</td></tr>`);

// debugging index
edit('debugging rows nat',
  `      <tr><td>PDF viewer reports a corrupt file part-way through</td>`,
  `      <tr><td>NAT instance up, private subnets have no egress</td><td><code>source_dest_check</code> still enabled on the ENI</td><td><code>describe-network-interfaces</code> and check <code>SourceDestCheck</code></td></tr>
      <tr><td>Egress fast for minutes then collapses</td><td>Burstable network credits exhausted</td><td>CloudWatch network metrics; move off <code>t4g.nano</code></td></tr>
      <tr><td>Egress lost after an instance replacement</td><td>Route targets the instance, not a persistent ENI</td><td>Route table target should be <code>network_interface_id</code></td></tr>
      <tr><td>New connections dropped under load, existing ones fine</td><td>Kernel conntrack table full</td><td><code>nf_conntrack_count</code> against <code>nf_conntrack_max</code></td></tr>
      <tr><td>PDF viewer reports a corrupt file part-way through</td>`);

writeFileSync(p, h);
console.log(steps.join('\n'));
