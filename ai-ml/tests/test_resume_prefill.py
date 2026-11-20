"""The resume parser's onboarding hints (name, age, education level, project ...) and its false-positive guards."""
from datetime import date

from app.services.knowledge_base import get_kb
from app.services.resume_parser import (
    analyze_text,
    education_labels,
    guess_age,
    guess_name,
    mask_contact_details,
    stated_interests,
    suggested_education,
)
from app.services.skill_extractor import extract_skills

kb = get_kb()
NL = chr(10)

RESUME = NL.join([
    "JANE Q DOE",
    "jane@example.com | +91 9876543210",
    "DOB: 14/03/2002",
    "Education",
    "M.Sc Data Science, B.Sc Mathematics",
    "Projects",
    "Career Bot (Group Project | Python, Flask, SQL",
    "Built a chatbot with scikit-learn",
    "Skills",
    "excel, pandas",
    "Interests",
    "Machine learning, cricket, web development",
])


def test_fields_are_filled_from_a_resume():
    r = analyze_text(RESUME, kb)
    assert r["name"] == "Jane Q Doe"
    assert r["age"] == guess_age("DOB: 14/03/2002")
    assert r["suggested_education"] == "postgraduate"  # a master's anywhere wins
    assert r["suggested_experience_type"] == "practical"
    assert r["project_title"] == "Career Bot"
    assert {"python", "flask", "sql"} <= set(r["tech_stack"])
    assert {"excel", "pandas", "python"} <= set(r["skills"])
    assert "machine learning" in r["interests"] and "web" in r["interests"]  # only what the resume states; cricket is ignored


def test_age_only_from_an_explicit_date_of_birth():
    assert guess_age("DOB: 14/03/2002", today=date(2026, 11, 8)) == 24
    assert guess_age("Date of Birth - 03.12.2005", today=date(2026, 11, 8)) == 20
    assert guess_age("born 31/02/2000") is None  # impossible date
    assert guess_age("I have 5 years of experience") is None  # never guessed
    assert guess_age("DOB: 01/01/2020", today=date(2026, 11, 8)) is None  # too young to be a student here


def test_name_ignores_headings_job_titles_and_places():
    assert guess_name("Resume" + NL + "Rahul Sharma | rahul@x.com") == "Rahul Sharma"
    assert guess_name("CURRICULUM VITAE" + NL + "rahul@x.com" + NL + "+91 9999999999") is None
    assert guess_name("DATA SCIENTIST" + NL + "John Doe" + NL + "john@x.com") == "John Doe"
    assert guess_name("Full Stack Developer" + NL + "Priya Nair | priya@x.com") == "Priya Nair"
    assert guess_name("New Delhi, India" + NL + "Asha Rao") == "Asha Rao"
    assert guess_name("Curriculum Vitae of Ravi Kumar" + NL + "ravi@x.com") == "Ravi Kumar"
    assert guess_name("Machine Learning Engineer") is None  # a title alone is not a name


def test_education_levels_and_the_word_be():
    assert suggested_education(["B.Tech/B.E.", "Diploma"]) == "undergraduate"
    assert suggested_education(["MBA"]) == "postgraduate"
    assert suggested_education([]) is None
    # an ordinary English "be" is not a B.E. degree
    assert education_labels("I will be able to learn quickly and want to be a developer.") == []
    assert education_labels("Hoping to BE ABLE to help.") == []
    # real spellings still are
    assert education_labels("B.E. in Computer Science") == ["B.Tech/B.E."]
    assert education_labels("BE (CSE), 2020") == ["B.Tech/B.E."]
    assert education_labels("BE Computer Science") == ["B.Tech/B.E."]
    assert education_labels("B.Tech Electronics") == ["B.Tech/B.E."]


def test_ordinary_words_are_not_skills_but_lists_are():
    prose = [
        "I express my interest in this role and react quickly to feedback.",
        "Looking to excel in a challenging environment. Ready to go beyond.",
        "Worked at Shell and Oracle; used lambda functions in an agile and scrum team.",
        "A hive of activity with macros and sheets of notes.",
    ]
    for text in prose:
        assert extract_skills(text, kb) == [], text
    assert {"express", "react", "excel", "go"} <= set(extract_skills("Skills: Express, React, Excel, Go", kb))
    assert {"express", "react", "excel", "go"} <= set(extract_skills(NL.join(["Technical Skills", "Express", "React", "Excel", "Go"]), kb))
    assert "react" in extract_skills("Built dashboards with ReactJS", kb)  # unambiguous spellings always count
    assert "excel" in extract_skills("Advanced Microsoft Excel", kb)


def test_non_resume_text_yields_no_guesses():
    r = analyze_text("Electricity bill for October. Amount due 1200. Please pay by the due date.", kb)
    assert r["name"] is None and r["age"] is None and r["suggested_education"] is None
    assert r["suggested_experience_type"] is None  # no evidence either way: do not claim 'theoretical'
    assert r["project_title"] is None and r["tech_stack"] == [] and r["interests"] == [] and r["skills"] == []
    assert analyze_text("Meeting notes: the project is delayed.", kb)["suggested_experience_type"] is None


def test_interests_are_never_inferred_from_skills():
    assert stated_interests("Skills" + NL + "python, sql", kb) == []


def test_contact_details_are_masked_in_the_text_snippet():
    r = analyze_text(RESUME, kb)
    assert "jane@example.com" not in r["location_text"] and "9876543210" not in r["location_text"]
    assert mask_contact_details("mail a@b.co or 9876543210") == "mail [email] or [phone]"
