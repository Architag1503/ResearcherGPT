import os
from crewai import Agent, Task, Crew, Process

# Configure LLM client configuration for CrewAI
# CrewAI allows specifying LLM model. By default, it looks at OPENAI_API_KEY.
# We configure placeholders or use local models where applicable.

def setup_research_crew(query: str, paper_texts: str):
    # 1. Define Agents
    researcher = Agent(
        role='Academic Researcher',
        goal=f'Analyze paper sources to answer the query: {query}',
        backstory="""You are a senior academic scholar specialized in literature analysis.
        You read abstracts, methodology sections, and results to extract key facts, methodologies, and limitations.""",
        verbose=True,
        allow_delegation=False
    )
    
    critic = Agent(
        role='Scientific Critic',
        goal='Identify weaknesses, contradictions, and gaps in research methodologies.',
        backstory="""You are a peer-reviewer for top-tier scientific journals.
        You analyze whether findings are supported by proper evaluations, check datasets, and locate gaps in empirical study.""",
        verbose=True,
        allow_delegation=False
    )
    
    writer = Agent(
        role='Academic Writer',
        goal='Draft publication-grade reports summarizing research findings.',
        backstory="""You write elegant, formal scientific prose.
        You ensure proper citation links and structures paragraphs logically, starting with abstracts down to conclusions.""",
        verbose=True,
        allow_delegation=False
    )
    
    # 2. Define Tasks
    task_research = Task(
        description=f"Read these academic texts:\n{paper_texts}\n\nExtract relevant passages answering: {query}",
        expected_output="Bullet list of key factual findings with author attribution.",
        agent=researcher
    )
    
    task_critic = Task(
        description="Review the researcher's findings and identify limitations, open questions, or dataset gaps.",
        expected_output="A list of three distinct research gaps with scientific rationale.",
        agent=critic
    )
    
    task_write = Task(
        description="Draft a formal 3-paragraph summary combining findings, references, and identified gaps.",
        expected_output="A markdown formatted report with references.",
        agent=writer
    )
    
    # 3. Assemble Crew
    crew = Crew(
        agents=[researcher, critic, writer],
        tasks=[task_research, task_critic, task_write],
        process=Process.sequential
    )
    
    return crew
