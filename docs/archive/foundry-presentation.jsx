import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Package, Users, GitBranch, Zap, CheckCircle, ArrowRight, Boxes, Search, Plus, Upload, Terminal, Sparkles, Clock, Shield, Rocket } from 'lucide-react';

const FoundryPresentation = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);

  // ServiceNow / AI Foundry inspired colors
  const colors = {
    primary: '#1A1F36',      // Dark navy
    secondary: '#293E40',    // Dark teal
    accent: '#62D84E',       // ServiceNow green
    accentDark: '#4CAF50',   
    surface: '#232940',
    surfaceLight: '#2D3555',
    text: '#FFFFFF',
    textMuted: '#A0AEC0',
    border: '#3D4663'
  };

  const stories = [
    {
      title: "Maya's First Day",
      subtitle: "New Team Member Onboarding",
      persona: "Maya - New AI Engineer",
      icon: <Sparkles className="w-8 h-8" />,
      steps: [
        {
          time: "9:00 AM",
          action: "Maya joins the AI Foundry team",
          detail: "She has Claude Code installed but needs to set up her first ServiceNow integration project",
          visual: "onboarding"
        },
        {
          time: "9:15 AM",
          action: "Connects to Foundry",
          detail: "One command adds the Foundry MCP server to her Claude Code setup",
          code: "npm install -g @servicenow-aif/foundry-mcp",
          visual: "connect"
        },
        {
          time: "9:20 AM",
          action: "Bootstraps her project",
          detail: "She asks Claude to set up a new project. Claude uses Foundry to pull all team-approved resources automatically.",
          chat: {
            user: "Start a new ServiceNow integration project for the HR module",
            claude: "I'll set up a new Foundry project with our standard ServiceNow stack..."
          },
          visual: "bootstrap"
        },
        {
          time: "9:25 AM",
          action: "Ready to code",
          detail: "Maya's project has all team skills, context, conventions, and tools. She's productive from minute one.",
          result: ["@foundry/servicenow-base context", "@foundry/research skill", "@approved/superpowers skills", "Team coding conventions", "Pre-configured MCP servers"],
          visual: "ready"
        }
      ]
    },
    {
      title: "Marcus Mid-Project",
      subtitle: "Adding Resources On-Demand",
      persona: "Marcus - Senior Developer",
      icon: <Search className="w-8 h-8" />,
      steps: [
        {
          time: "2:00 PM",
          action: "Marcus hits a roadblock",
          detail: "His project needs to interact with Glide APIs, but he's not sure if the team has existing patterns",
          visual: "problem"
        },
        {
          time: "2:02 PM",
          action: "Searches the catalog",
          detail: "He asks Claude what's available. Foundry searches both internal and approved external resources.",
          chat: {
            user: "Do we have anything for Glide API integration?",
            claude: "Found @foundry/glide-api (v1.2.0) - handles authentication, pagination, and common queries. Want me to add it?"
          },
          visual: "search"
        },
        {
          time: "2:03 PM",
          action: "Adds the skill instantly",
          detail: "One confirmation and the skill is linked to his project, version-locked for reproducibility",
          code: "foundry add @foundry/glide-api",
          visual: "add"
        },
        {
          time: "2:05 PM",
          action: "Back to building",
          detail: "Claude now knows Glide patterns. Marcus continues without writing boilerplate or reading docs.",
          visual: "continue"
        }
      ]
    },
    {
      title: "Sofia Contributes Back",
      subtitle: "Sharing Knowledge with the Team",
      persona: "Sofia - Tech Lead",
      icon: <Upload className="w-8 h-8" />,
      steps: [
        {
          time: "4:00 PM",
          action: "Sofia builds something reusable",
          detail: "While working on her project, she created a skill for automated SLA calculations that others could use",
          visual: "create"
        },
        {
          time: "4:15 PM",
          action: "Validates her contribution",
          detail: "Foundry checks the skill follows team standards - has docs, examples, proper manifest",
          chat: {
            user: "Validate my sla-calculator skill for contribution",
            claude: "Validation passed ✓ - manifest valid, docs present, examples included. Ready to promote."
          },
          visual: "validate"
        },
        {
          time: "4:20 PM",
          action: "Promotes to Golden Repo",
          detail: "One command creates a PR. The designated reviewer gets notified.",
          code: "foundry promote skill sla-calculator",
          visual: "promote"
        },
        {
          time: "Next Day",
          action: "Team benefits",
          detail: "After lightweight review and approval, @foundry/sla-calculator is available to everyone via foundry sync",
          result: ["Searchable in catalog", "Available in templates", "Version controlled", "Team knowledge preserved"],
          visual: "shared"
        }
      ]
    }
  ];

  const slides = [
    // Slide 0: Title
    {
      id: 'title',
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-teal-500/20 border border-green-500/30">
            <Boxes className="w-16 h-16 text-green-400" />
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-transparent">
            Foundry
          </h1>
          <p className="text-2xl text-gray-300 mb-2">Golden Repository Framework</p>
          <p className="text-lg text-gray-500 mb-8">AI Foundry Team Resource Management</p>
          <div className="flex gap-4 mt-4">
            <div className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-400">
              Skills • Agents • Context • Plugins
            </div>
          </div>
        </div>
      )
    },
    // Slide 1: The Problem
    {
      id: 'problem',
      content: (
        <div className="flex flex-col h-full px-8 py-6">
          <h2 className="text-3xl font-bold mb-8 text-white">The Challenge</h2>
          <div className="grid grid-cols-2 gap-6 flex-1">
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <Clock className="w-5 h-5" /> Slow Onboarding
                </h3>
                <p className="text-gray-400 text-sm">New team members spend days setting up projects and learning team patterns</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5" /> Knowledge Silos
                </h3>
                <p className="text-gray-400 text-sm">Great skills and prompts exist but aren't discoverable or shared</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <GitBranch className="w-5 h-5" /> No Version Control
                </h3>
                <p className="text-gray-400 text-sm">Skills and context files drift between projects with no source of truth</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <Package className="w-5 h-5" /> Manual Plugin Management
                </h3>
                <p className="text-gray-400 text-sm">Each person manually installs and configures external plugins like superpowers</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5" /> Inconsistent Quality
                </h3>
                <p className="text-gray-400 text-sm">No vetting process for external resources - unknown security/reliability</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5" /> Repeated Work
                </h3>
                <p className="text-gray-400 text-sm">Multiple people solving the same problems independently</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 2: The Solution
    {
      id: 'solution',
      content: (
        <div className="flex flex-col h-full px-8 py-6">
          <h2 className="text-3xl font-bold mb-6 text-white">The Solution: Foundry</h2>
          <p className="text-gray-400 mb-6">A unified system to curate, distribute, and contribute Claude Code resources</p>
          
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-full max-w-2xl">
              {/* Central Hub */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center z-10 shadow-lg shadow-green-500/30">
                <div className="text-center">
                  <Boxes className="w-8 h-8 mx-auto mb-1 text-white" />
                  <span className="text-white font-bold text-sm">Golden<br/>Repo</span>
                </div>
              </div>
              
              {/* Orbiting elements */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-24 rounded-xl bg-gray-800 border border-gray-700 flex flex-col items-center justify-center p-2">
                <Package className="w-6 h-6 text-green-400 mb-1" />
                <span className="text-xs text-gray-300 text-center">Skills</span>
              </div>
              
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-24 h-24 rounded-xl bg-gray-800 border border-gray-700 flex flex-col items-center justify-center p-2">
                <Users className="w-6 h-6 text-blue-400 mb-1" />
                <span className="text-xs text-gray-300 text-center">Agents</span>
              </div>
              
              <div className="absolute left-1/4 top-0 w-24 h-24 rounded-xl bg-gray-800 border border-gray-700 flex flex-col items-center justify-center p-2">
                <Terminal className="w-6 h-6 text-purple-400 mb-1" />
                <span className="text-xs text-gray-300 text-center">Context</span>
              </div>
              
              <div className="absolute right-1/4 top-0 w-24 h-24 rounded-xl bg-gray-800 border border-gray-700 flex flex-col items-center justify-center p-2">
                <Zap className="w-6 h-6 text-yellow-400 mb-1" />
                <span className="text-xs text-gray-300 text-center">MCP<br/>Servers</span>
              </div>
              
              <div className="absolute left-1/4 bottom-0 w-24 h-24 rounded-xl bg-gray-800 border border-gray-700 flex flex-col items-center justify-center p-2">
                <Sparkles className="w-6 h-6 text-pink-400 mb-1" />
                <span className="text-xs text-gray-300 text-center">Prompts</span>
              </div>
              
              <div className="absolute right-1/4 bottom-0 w-24 h-24 rounded-xl bg-gray-800 border border-purple-500/50 flex flex-col items-center justify-center p-2 bg-purple-500/10">
                <Package className="w-6 h-6 text-purple-400 mb-1" />
                <span className="text-xs text-gray-300 text-center">External<br/>Plugins</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-center gap-4">
            <div className="px-3 py-1 rounded bg-green-500/20 text-green-400 text-sm">@foundry/* internal</div>
            <div className="px-3 py-1 rounded bg-purple-500/20 text-purple-400 text-sm">@approved/* vetted external</div>
          </div>
        </div>
      )
    },
    // Slide 3: How It Works
    {
      id: 'how',
      content: (
        <div className="flex flex-col h-full px-8 py-6">
          <h2 className="text-3xl font-bold mb-6 text-white">How It Works</h2>
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-4 mb-8">
              {/* Step 1 */}
              <div className="flex-1 p-4 rounded-xl bg-gray-800 border border-gray-700">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                  <span className="text-green-400 font-bold">1</span>
                </div>
                <h3 className="font-semibold text-white mb-2">Connect Once</h3>
                <p className="text-gray-400 text-sm">Add Foundry MCP server to Claude Code</p>
                <div className="mt-2 px-2 py-1 bg-gray-900 rounded text-xs font-mono text-green-400">
                  npm install @aif/foundry
                </div>
              </div>
              
              <ChevronRight className="w-6 h-6 text-gray-600 flex-shrink-0" />
              
              {/* Step 2 */}
              <div className="flex-1 p-4 rounded-xl bg-gray-800 border border-gray-700">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                  <span className="text-green-400 font-bold">2</span>
                </div>
                <h3 className="font-semibold text-white mb-2">Bootstrap Projects</h3>
                <p className="text-gray-400 text-sm">Ask Claude to start a new project with team resources</p>
                <div className="mt-2 px-2 py-1 bg-gray-900 rounded text-xs font-mono text-blue-400">
                  "Start a new SPARC project"
                </div>
              </div>
              
              <ChevronRight className="w-6 h-6 text-gray-600 flex-shrink-0" />
              
              {/* Step 3 */}
              <div className="flex-1 p-4 rounded-xl bg-gray-800 border border-gray-700">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                  <span className="text-green-400 font-bold">3</span>
                </div>
                <h3 className="font-semibold text-white mb-2">Discover & Add</h3>
                <p className="text-gray-400 text-sm">Search catalog and add resources conversationally</p>
                <div className="mt-2 px-2 py-1 bg-gray-900 rounded text-xs font-mono text-blue-400">
                  "Add the Glide API skill"
                </div>
              </div>
              
              <ChevronRight className="w-6 h-6 text-gray-600 flex-shrink-0" />
              
              {/* Step 4 */}
              <div className="flex-1 p-4 rounded-xl bg-gray-800 border border-gray-700">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                  <span className="text-green-400 font-bold">4</span>
                </div>
                <h3 className="font-semibold text-white mb-2">Contribute Back</h3>
                <p className="text-gray-400 text-sm">Share new skills with the team via PR</p>
                <div className="mt-2 px-2 py-1 bg-gray-900 rounded text-xs font-mono text-purple-400">
                  "Promote my new skill"
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-teal-500/10 border border-green-500/30">
              <p className="text-center text-gray-300">
                <span className="text-green-400 font-semibold">Key Insight:</span> Claude Code becomes the interface. 
                No CLI to memorize—just have conversations.
              </p>
            </div>
          </div>
        </div>
      )
    },
    // Slide 4: Storyboard
    {
      id: 'stories',
      content: (
        <div className="flex flex-col h-full px-6 py-4">
          <h2 className="text-2xl font-bold mb-4 text-white">A Day in the Life</h2>
          
          {/* Story selector */}
          <div className="flex gap-2 mb-4">
            {stories.map((story, idx) => (
              <button
                key={idx}
                onClick={() => { setStoryIndex(idx); }}
                className={`flex-1 p-3 rounded-lg border transition-all ${
                  storyIndex === idx 
                    ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 justify-center">
                  {story.icon}
                  <div className="text-left">
                    <div className="font-semibold text-sm">{story.title}</div>
                    <div className="text-xs opacity-70">{story.persona}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          {/* Story content */}
          <div className="flex-1 overflow-hidden">
            <div className="grid grid-cols-4 gap-3 h-full">
              {stories[storyIndex].steps.map((step, idx) => (
                <div 
                  key={idx}
                  className="flex flex-col p-3 rounded-xl bg-gray-800 border border-gray-700"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-400 text-xs font-bold">{idx + 1}</span>
                    </div>
                    <span className="text-xs text-gray-500">{step.time}</span>
                  </div>
                  
                  <h4 className="font-semibold text-white text-sm mb-1">{step.action}</h4>
                  <p className="text-gray-400 text-xs mb-2 flex-1">{step.detail}</p>
                  
                  {step.code && (
                    <div className="px-2 py-1 bg-gray-900 rounded text-xs font-mono text-green-400 mb-2 overflow-x-auto">
                      {step.code}
                    </div>
                  )}
                  
                  {step.chat && (
                    <div className="space-y-1 mb-2">
                      <div className="px-2 py-1 bg-blue-500/10 rounded text-xs text-blue-300 border-l-2 border-blue-500">
                        {step.chat.user}
                      </div>
                      <div className="px-2 py-1 bg-green-500/10 rounded text-xs text-green-300 border-l-2 border-green-500">
                        {step.chat.claude}
                      </div>
                    </div>
                  )}
                  
                  {step.result && (
                    <div className="space-y-1">
                      {step.result.map((r, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs text-gray-400">
                          <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    // Slide 5: Benefits
    {
      id: 'benefits',
      content: (
        <div className="flex flex-col h-full px-8 py-6">
          <h2 className="text-3xl font-bold mb-6 text-white">Impact</h2>
          
          <div className="grid grid-cols-3 gap-6 flex-1">
            <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/30">
              <Rocket className="w-10 h-10 text-green-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Faster Onboarding</h3>
              <p className="text-gray-400 mb-4">New team members productive in minutes, not days</p>
              <div className="text-3xl font-bold text-green-400">~90%</div>
              <div className="text-sm text-gray-500">reduction in setup time</div>
            </div>
            
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/30">
              <Users className="w-10 h-10 text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Knowledge Sharing</h3>
              <p className="text-gray-400 mb-4">Best practices spread automatically across all projects</p>
              <div className="text-3xl font-bold text-blue-400">1 → All</div>
              <div className="text-sm text-gray-500">solve once, benefit everywhere</div>
            </div>
            
            <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/30">
              <Shield className="w-10 h-10 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Controlled Quality</h3>
              <p className="text-gray-400 mb-4">Vetted resources with version control and approval process</p>
              <div className="text-3xl font-bold text-purple-400">100%</div>
              <div className="text-sm text-gray-500">resources reviewed before use</div>
            </div>
          </div>
          
          <div className="mt-6 p-4 rounded-xl bg-gray-800 border border-gray-700">
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">Skills</div>
                <div className="text-sm text-gray-400">Reusable capabilities</div>
              </div>
              <div className="text-gray-600">+</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">Agents</div>
                <div className="text-sm text-gray-400">Orchestration patterns</div>
              </div>
              <div className="text-gray-600">+</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">Context</div>
                <div className="text-sm text-gray-400">Domain knowledge</div>
              </div>
              <div className="text-gray-600">+</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">Plugins</div>
                <div className="text-sm text-gray-400">External integrations</div>
              </div>
              <div className="text-gray-600">=</div>
              <div className="text-center px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/50">
                <div className="text-2xl font-bold text-green-400">Foundry</div>
                <div className="text-sm text-green-400/70">Unified Platform</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 6: Timeline
    {
      id: 'timeline',
      content: (
        <div className="flex flex-col h-full px-8 py-6">
          <h2 className="text-3xl font-bold mb-6 text-white">Implementation Roadmap</h2>
          
          <div className="flex-1 flex items-center">
            <div className="w-full">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute top-6 left-0 right-0 h-1 bg-gray-700 rounded"></div>
                <div className="absolute top-6 left-0 w-1/4 h-1 bg-green-500 rounded"></div>
                
                {/* Timeline points */}
                <div className="relative flex justify-between">
                  <div className="flex flex-col items-center w-1/4">
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center z-10 mb-4">
                      <span className="text-white font-bold">1</span>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-800 border border-green-500/50 w-full">
                      <h4 className="font-semibold text-green-400 mb-1">Sprint 1-2</h4>
                      <h3 className="font-semibold text-white mb-2">Foundation</h3>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Golden repo structure</li>
                        <li>• Core MCP server</li>
                        <li>• Init, add, sync tools</li>
                        <li>• First skills migrated</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center w-1/4">
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center z-10 mb-4">
                      <span className="text-gray-300 font-bold">2</span>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 w-full">
                      <h4 className="font-semibold text-gray-500 mb-1">Sprint 3-4</h4>
                      <h3 className="font-semibold text-white mb-2">Discovery</h3>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Search & catalog</li>
                        <li>• External registry</li>
                        <li>• @approved/* support</li>
                        <li>• Project templates</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center w-1/4">
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center z-10 mb-4">
                      <span className="text-gray-300 font-bold">3</span>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 w-full">
                      <h4 className="font-semibold text-gray-500 mb-1">Sprint 5-6</h4>
                      <h3 className="font-semibold text-white mb-2">Contribution</h3>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Validate & promote</li>
                        <li>• PR automation</li>
                        <li>• Version management</li>
                        <li>• Team pilot</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center w-1/4">
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center z-10 mb-4">
                      <span className="text-gray-300 font-bold">4</span>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 w-full">
                      <h4 className="font-semibold text-gray-500 mb-1">Sprint 7+</h4>
                      <h3 className="font-semibold text-white mb-2">Scale</h3>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Full team rollout</li>
                        <li>• Content buildout</li>
                        <li>• Advanced features</li>
                        <li>• Cross-team sharing</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <p className="text-center text-gray-300">
              <span className="text-green-400 font-semibold">MVP Target:</span> Usable foundation in 4 weeks. 
              Full system in 8-10 weeks.
            </p>
          </div>
        </div>
      )
    },
    // Slide 7: Next Steps
    {
      id: 'next',
      content: (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
          <h2 className="text-3xl font-bold mb-8 text-white">Next Steps</h2>
          
          <div className="grid grid-cols-3 gap-6 mb-8 w-full max-w-3xl">
            <div className="p-6 rounded-xl bg-gray-800 border border-gray-700">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-green-400 font-bold text-xl">1</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Team Input</h3>
              <p className="text-gray-400 text-sm">Gather feedback on resource types and workflow</p>
            </div>
            
            <div className="p-6 rounded-xl bg-gray-800 border border-gray-700">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-green-400 font-bold text-xl">2</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Inventory Skills</h3>
              <p className="text-gray-400 text-sm">Catalog existing team resources for migration</p>
            </div>
            
            <div className="p-6 rounded-xl bg-gray-800 border border-gray-700">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-green-400 font-bold text-xl">3</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Build MVP</h3>
              <p className="text-gray-400 text-sm">Golden repo + core MCP tools in Sprint 1</p>
            </div>
          </div>
          
          <div className="p-6 rounded-xl bg-gradient-to-r from-green-500/20 to-teal-500/20 border border-green-500/30 max-w-xl">
            <Boxes className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-lg text-gray-300">
              Foundry transforms how we share knowledge and bootstrap projects—making 
              the whole team faster, together.
            </p>
          </div>
        </div>
      )
    }
  ];

  const nextSlide = () => setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  const prevSlide = () => setCurrentSlide((prev) => Math.max(prev - 1, 0));

  return (
    <div 
      className="w-full h-screen flex flex-col"
      style={{ backgroundColor: colors.primary, color: colors.text }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: colors.border }}>
        <div className="flex items-center gap-3">
          <Boxes className="w-6 h-6 text-green-400" />
          <span className="font-semibold">Foundry</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400 text-sm">AI Foundry Team</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {currentSlide + 1} / {slides.length}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {slides[currentSlide].content}
      </div>
      
      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: colors.border }}>
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            currentSlide === 0 
              ? 'text-gray-600 cursor-not-allowed' 
              : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>
        
        {/* Slide indicators */}
        <div className="flex gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentSlide ? 'bg-green-400' : 'bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
        
        <button
          onClick={nextSlide}
          disabled={currentSlide === slides.length - 1}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            currentSlide === slides.length - 1
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          Next
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default FoundryPresentation;
