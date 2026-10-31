from app.models import FetchedSource
from app.pipeline.dna import analyse, containment, sentences, shingles

OFFICIAL = ("The annual income of parents from all sources should not exceed Rs 2,50,000 for this scheme. "
            "A valid income certificate issued by the competent authority must be uploaded with the application form. "
            "Renewal applications must be submitted every academic year through the national portal.")
BLOG_A = ("Here is our simple guide for students this year. Students should keep the latest ITR acknowledgement ready during document verification at the college. "
          "The last date for submitting the online application is 30 November and late forms are not accepted by anyone.")
# BLOG_B copies BLOG_A almost word for word, with a new intro.
BLOG_B = ("Top tips from our team! Students should keep the latest ITR acknowledgement ready during document verification at the college. "
          "The last date for submitting the online application is 30 November and late forms are not accepted by anyone.")


def src(sid, text, state="Readable"):
    return FetchedSource(id=sid, url=f"https://{sid}.example/", host=f"{sid}.example", name=sid, text=text, state=state)


def test_copied_blogs_form_a_cluster():
    dna = analyse([src("S1", OFFICIAL), src("S2", BLOG_A), src("S3", BLOG_B)])
    top = dna.pairs[0]
    assert {top.a, top.b} == {"S2", "S3"} and top.relation == "copied" and top.overlap >= 50
    assert dna.clusters == [["S2", "S3"]]
    assert any("ITR acknowledgement" in s for s in top.shared_sentences)


def test_independent_sources_are_not_grouped():
    dna = analyse([src("S1", OFFICIAL), src("S2", BLOG_A)])
    assert dna.pairs[0].relation == "independent" and dna.clusters == []
    assert "independent" in dna.note


def test_unreadable_sources_are_ignored():
    dna = analyse([src("S1", OFFICIAL), src("S2", "", state="Blocked")])
    assert dna.pairs == [] and "two readable" in dna.note


def test_helpers():
    assert containment(set(), {"a"}) == 0
    assert containment(shingles(BLOG_A), shingles(BLOG_A)) == 100
    assert all(len(s.split()) >= 8 for s in sentences(OFFICIAL))
