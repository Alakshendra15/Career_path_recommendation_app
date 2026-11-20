"""One-off, re-runnable: grow the knowledge base using real job-posting data.

Source: lukebarousse/data_jobs on Hugging Face (Apache-2.0, ~785k Google job postings, 2023), file
data/real/data_jobs.parquet (see training/README.md for how to download it).

What it does
  1. appends skills that real postings ask for but skills.csv lacked (cloud, big data, BI tools ...)
  2. adds 2 careers the dataset covers well: Data Engineer, Cloud Engineer
     (Business Analyst was tried and dropped: its real postings overlap Data Analyst so much that it cost accuracy)
  3. derives their skill weights from how often each skill appears in postings of that career
     (weight 1-5 from frequency; 'core' = in >= 25% of postings) instead of hand-picking them

Existing careers keep their hand-written weights. Running it twice is safe (rows are de-duplicated).
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.services.knowledge_base import load_kb  # noqa: E402

DATA = ROOT / "data"
PARQUET = DATA / "real" / "data_jobs.parquet"

NEW_SKILLS = [  # skill, aliases, category, level, est_hours
    ("r", "r programming|rstudio", "programming", "beginner", 40),
    ("aws", "amazon web services|ec2|s3|lambda", "cloud", "intermediate", 50),
    ("azure", "microsoft azure", "cloud", "intermediate", 50),
    ("gcp", "google cloud|google cloud platform", "cloud", "intermediate", 50),
    ("spark", "apache spark|pyspark", "data", "intermediate", 50),
    ("hadoop", "hdfs|mapreduce|hive", "data", "intermediate", 40),
    ("scala", "", "programming", "intermediate", 50),
    ("snowflake", "", "data", "intermediate", 30),
    ("databricks", "", "data", "intermediate", 30),
    ("kafka", "apache kafka", "data", "advanced", 40),
    ("airflow", "apache airflow", "data", "intermediate", 30),
    ("etl", "elt|data pipelines|data pipeline|data warehousing|data warehouse", "data", "intermediate", 40),
    ("kubernetes", "k8s", "tools", "advanced", 40),
    ("terraform", "infrastructure as code", "tools", "intermediate", 30),
    ("ci/cd", "cicd|jenkins|github actions|gitlab ci", "tools", "intermediate", 30),
    ("bash", "shell|shell scripting|powershell", "tools", "beginner", 20),
    ("sas", "", "analytics", "intermediate", 40),
    ("bigquery", "", "database", "intermediate", 25),
    ("redshift", "", "database", "intermediate", 25),
    ("nosql", "cassandra|dynamodb|redis|elasticsearch", "database", "intermediate", 30),
    ("go", "golang", "programming", "intermediate", 50),
    ("c#", "csharp|.net|dotnet", "programming", "intermediate", 60),
    ("looker", "looker studio|data studio", "analytics", "beginner", 20),
    ("qlik", "qlikview|qlik sense", "analytics", "beginner", 20),
    ("sap", "", "tools", "intermediate", 40),
    ("vba", "excel vba|macros", "analytics", "intermediate", 25),
    ("spss", "", "analytics", "beginner", 20),
    ("matlab", "", "programming", "intermediate", 40),
    ("jira", "confluence|agile|scrum", "tools", "beginner", 10),
    ("powerpoint", "", "tools", "beginner", 10),
    ("ssis", "ssrs|ssas", "data", "intermediate", 30),
]
# aliases added to skills that already exist
EXTRA_ALIASES = {
    "sql": ["sql server", "oracle", "mssql", "ms sql"],
    "power bi": ["dax", "powerbi"],
    "excel": ["google sheets", "sheets", "spreadsheets"],
}

NEW_CAREERS = [  # career_id, title, description, interest_tags, dataset job_title_short values
    ("data_engineer", "Data Engineer",
     "Builds and maintains the pipelines and warehouses that move and store data so analysts and data scientists can use it",
     "data|pipelines|big data|cloud|engineering|databases",
     ["Data Engineer", "Senior Data Engineer"]),
    ("cloud_engineer", "Cloud Engineer",
     "Designs deploys and automates cloud infrastructure and keeps applications reliable secure and scalable",
     "cloud|infrastructure|devops|automation|security|deployment",
     ["Cloud Engineer"]),
]

NEW_PREREQS = [
    ("spark", "python"), ("spark", "sql"), ("databricks", "spark"), ("airflow", "python"), ("etl", "sql"),
    ("snowflake", "sql"), ("bigquery", "sql"), ("redshift", "sql"), ("kubernetes", "docker"),
    ("ci/cd", "git"), ("terraform", "aws"), ("kafka", "python"), ("vba", "excel"), ("looker", "sql"),
]

NEW_RESOURCES = [
    # added after the audit: every skill that had no learning link (official docs / free courses)
    ('seaborn', 'Seaborn Tutorial', 'https://seaborn.pydata.org/tutorial.html', 'doc'),
    ('eda', '10 Minutes to pandas', 'https://pandas.pydata.org/docs/user_guide/10min.html', 'doc'),
    ('keras', 'Keras Getting Started', 'https://keras.io/getting_started/', 'doc'),
    ('model deployment', 'FastAPI - Deployment', 'https://fastapi.tiangolo.com/deployment/', 'doc'),
    ('angular', 'Angular Tutorials', 'https://angular.dev/tutorials', 'doc'),
    ('vue', 'Vue Tutorial', 'https://vuejs.org/tutorial/', 'doc'),
    ('rest api', 'RESTful API Tutorial', 'https://restfulapi.net/', 'doc'),
    ('responsive design', 'web.dev - Learn Responsive Design', 'https://web.dev/learn/design', 'course'),
    ('orm', 'SQLAlchemy Unified Tutorial', 'https://docs.sqlalchemy.org/en/20/tutorial/', 'doc'),
    ('data structures', 'VisuAlgo Data Structures', 'https://visualgo.net/en', 'course'),
    ('web scraping', 'Beautiful Soup Documentation', 'https://beautiful-soup-4.readthedocs.io/en/latest/', 'doc'),
    ('automation', 'Automate the Boring Stuff with Python', 'https://automatetheboringstuff.com/', 'book'),
    ('java', 'dev.java Learn', 'https://dev.java/learn/', 'doc'),
    ('c++', 'learncpp.com', 'https://www.learncpp.com/', 'course'),
    ('jupyter', 'Jupyter Documentation', 'https://docs.jupyter.org/en/latest/', 'doc'),
    ('hadoop', 'Hadoop Single Node Setup', 'https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-common/SingleCluster.html', 'doc'),
    ('scala', 'Tour of Scala', 'https://docs.scala-lang.org/tour/tour-of-scala.html', 'doc'),
    ('databricks', 'Databricks Getting Started', 'https://docs.databricks.com/en/getting-started/index.html', 'doc'),
    ('bigquery', 'BigQuery Quickstarts', 'https://cloud.google.com/bigquery/docs/quickstarts', 'doc'),
    ('nosql', 'MongoDB University', 'https://learn.mongodb.com/', 'course'),
    ('go', 'A Tour of Go', 'https://go.dev/tour/', 'course'),
    ('c#', 'Tour of C#', 'https://learn.microsoft.com/en-us/dotnet/csharp/tour-of-csharp/', 'doc'),
    ('sap', 'SAP Learning', 'https://learning.sap.com/', 'course'),
    ('vba', 'Getting Started with VBA in Office', 'https://learn.microsoft.com/en-us/office/vba/library-reference/concepts/getting-started-with-vba-in-office', 'doc'),
    ('matlab', 'MATLAB Academy', 'https://matlabacademy.mathworks.com/', 'course'),
    ('jira', 'Jira Basics Guide', 'https://www.atlassian.com/software/jira/guides/getting-started/basics', 'doc'),
    ('powerpoint', 'PowerPoint Help and Learning', 'https://support.microsoft.com/en-us/powerpoint', 'doc'),
    ('ssis', 'SSIS Tutorial: Create an ETL Package', 'https://learn.microsoft.com/en-us/sql/integration-services/ssis-how-to-create-an-etl-package', 'doc'),
    ('computer vision', 'Kaggle Learn - Computer Vision', 'https://www.kaggle.com/learn/computer-vision', 'course'),
    ('feature engineering', 'Kaggle Learn - Feature Engineering', 'https://www.kaggle.com/learn/feature-engineering', 'course'),
    ('oop', 'Real Python - Object-Oriented Programming', 'https://realpython.com/python3-object-oriented-programming/', 'doc'),
    ('linux', 'Linux Journey', 'https://linuxjourney.com/', 'course'),
    ('bash', 'Bash Reference Manual', 'https://www.gnu.org/software/bash/manual/bash.html', 'doc'),
    ('redshift', 'Amazon Redshift Getting Started', 'https://docs.aws.amazon.com/redshift/latest/gsg/getting-started.html', 'doc'),
    ("aws", "AWS Cloud Practitioner Essentials", "https://explore.skillbuilder.aws/learn", "course"),
    ("azure", "Microsoft Learn - Azure Fundamentals", "https://learn.microsoft.com/training/paths/azure-fundamentals-describe-azure-architecture-services/", "course"),
    ("gcp", "Google Cloud Skills Boost", "https://www.cloudskillsboost.google/", "course"),
    ("spark", "Spark Official Quick Start", "https://spark.apache.org/docs/latest/quick-start.html", "doc"),
    ("airflow", "Airflow Tutorial", "https://airflow.apache.org/docs/apache-airflow/stable/tutorial/index.html", "doc"),
    ("kafka", "Kafka Introduction", "https://kafka.apache.org/intro", "doc"),
    ("kubernetes", "Kubernetes Basics", "https://kubernetes.io/docs/tutorials/kubernetes-basics/", "doc"),
    ("terraform", "HashiCorp Terraform Tutorials", "https://developer.hashicorp.com/terraform/tutorials", "course"),
    ("snowflake", "Snowflake Quickstarts", "https://quickstarts.snowflake.com/", "course"),
    ("r", "R for Data Science (free book)", "https://r4ds.hadley.nz/", "book"),
    ("etl", "Data Engineering Zoomcamp", "https://github.com/DataTalksClub/data-engineering-zoomcamp", "course"),
    ("ci/cd", "GitHub Actions Docs", "https://docs.github.com/actions", "doc"),
]

NEW_ROLES = [
    ("Junior Data Engineer", "data_engineer", "entry", "python|sql|etl|spark"),
    ("Data Engineer Trainee", "data_engineer", "entry", "sql|python|airflow|aws"),
    ("Cloud Support Associate", "cloud_engineer", "entry", "aws|linux|bash|git"),
    ("Junior DevOps Engineer", "cloud_engineer", "entry", "docker|ci/cd|linux|git|aws"),
]


def append_unique(path: Path, rows: list[dict], key: list[str]) -> int:
    df = pd.read_csv(path)
    new = pd.DataFrame(rows)
    merged = pd.concat([df, new], ignore_index=True).drop_duplicates(subset=key, keep="first")
    added = len(merged) - len(df)
    merged.to_csv(path, index=False)
    return added


def main() -> None:
    # 1. skills + aliases
    skills_path = DATA / "skills.csv"
    sk = pd.read_csv(skills_path)
    for skill, extra in EXTRA_ALIASES.items():
        i = sk.index[sk.skill == skill][0]
        have = [a for a in str(sk.at[i, "aliases"]).split("|") if a and a != "nan"]
        sk.at[i, "aliases"] = "|".join(dict.fromkeys(have + extra))
    sk.to_csv(skills_path, index=False)
    n = append_unique(skills_path, [dict(zip(sk.columns, r)) for r in NEW_SKILLS], ["skill"])
    print(f"skills added: {n}")

    # 2. careers, prereqs, resources, roles
    n = append_unique(DATA / "careers.csv", [
        {"career_id": c[0], "title": c[1], "description": c[2], "interest_tags": c[3]} for c in NEW_CAREERS], ["career_id"])
    print(f"careers added: {n}")
    n = append_unique(DATA / "skill_prereqs.csv", [{"skill": s, "prerequisite": p} for s, p in NEW_PREREQS], ["skill", "prerequisite"])
    print(f"prereqs added: {n}")
    n = append_unique(DATA / "skill_resources.csv", [dict(skill=s, title=t, url=u, type=ty) for s, t, u, ty in NEW_RESOURCES], ["skill", "url"])
    print(f"resources added: {n}")
    n = append_unique(DATA / "job_roles.csv", [dict(role_title=a, career_id=b, level=c, required_skills=d) for a, b, c, d in NEW_ROLES], ["role_title"])
    print(f"job roles added: {n}")

    # 3. data-driven career_skills for the new careers
    kb = load_kb()  # now includes the new skills/aliases
    df = pd.read_parquet(PARQUET, columns=["job_title_short", "job_skills"]).dropna(subset=["job_skills"])
    rows = []
    for cid, _, _, _, titles in NEW_CAREERS:
        sub = df[df.job_title_short.isin(titles)]
        counts: dict[str, int] = {}
        for raw in sub.job_skills:
            canon = {c for s in ast.literal_eval(raw) if (c := kb.canonical(s))}
            for c in canon:
                counts[c] = counts.get(c, 0) + 1
        freq = {s: n / len(sub) for s, n in counts.items()}
        top = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)
        top = [(s, f) for s, f in top if f >= 0.08][:14]
        print(f"{cid}: {len(sub)} postings -> " + ", ".join(f"{s} {f:.0%}" for s, f in top))
        for s, f in top:
            rows.append({"career_id": cid, "skill": s, "weight": int(min(5, max(1, round(f * 8)))), "type": "core" if f >= 0.25 else "supporting"})
    n = append_unique(DATA / "career_skills.csv", rows, ["career_id", "skill"])
    print(f"career_skills rows added: {n}")


if __name__ == "__main__":
    main()
