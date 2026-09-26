import unittest
from pipeline.allocation import allocate, allocate_region, perturb, first_change, below_half_threshold, AllocationTie, UnsupportedAllocation
from pipeline.regional import audit, calculate_breakdown, published_breakdown
from pipeline.parsers import elections
from pipeline.build import allocation_votes, validate_sources, EXPECTED_TOTALS, EXPECTED_COUNTS


class OfficialReproduction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = elections()

    def test_provenance_integrity(self):
        validate_sources()

    def test_every_party_every_election(self):
        for e in self.data:
            with self.subTest(year=e["year"]):
                self.assertEqual(len(e["parties"]),EXPECTED_COUNTS[e["year"]])
                self.assertEqual(e["voteTotal"],EXPECTED_TOTALS[e["year"]])
                self.assertEqual(allocate(allocation_votes(e)),{p["party"]:p["officialSeats"] for p in e["parties"]})

    def test_2024_requires_both_ballots(self):
        e=self.data[-1]
        wrong=allocate({p["party"]:p["votes"] for p in e["parties"]})
        self.assertNotEqual(wrong,{p["party"]:p["officialSeats"] for p in e["parties"]})
        self.assertEqual(allocate(allocation_votes(e))["AFRICAN NATIONAL CONGRESS"],159)

    def test_2004_corrected_entitlement(self):
        result=allocate(allocation_votes(self.data[2]))
        self.assertEqual(result['AFRICAN CHRISTIAN DEMOCRATIC PARTY'],7)
        self.assertEqual(result["AZANIAN PEOPLE'S ORGANISATION"],1)

    def test_regional_and_compensatory_baselines(self):
        audits = [audit(e) for e in self.data]
        self.assertEqual([a['year'] for a in audits if a['status']=='passed'],[2004,2009,2014,2019,2024])
        self.assertEqual(sum(a.get('regionalCellsMatched',0) for a in audits),1638)
        self.assertEqual(sum(a.get('oneBallotChecks',{}).get('tested',0) for a in audits),50960)
        for a in audits[2:]:
            self.assertEqual(sum(a['calculated']['compensatory'].values()),200)
            self.assertEqual(a['oneBallotChecks']['changes'],[])
            self.assertEqual(a['oneBallotChecks']['ties'],[])
        # Explicit public report cell: 2024 ANC 86 regional + 73 compensatory.
        self.assertEqual(audits[-1]['calculated']['compensatory']['AFRICAN NATIONAL CONGRESS'],73)

    def test_winning_independent_is_not_silently_treated_as_party(self):
        import copy
        e=copy.deepcopy(self.data[-1])
        candidate=next(p for p in e['regionalBallot'] if p['party']=='ACHMAT ZACKIE - 583999')
        candidate['provinceVotes']['Western Cape']=10000000
        with self.assertRaises(UnsupportedAllocation):
            calculate_breakdown(e,published_breakdown(2024)['capacities'])


class Arithmetic(unittest.TestCase):
    def test_iec_regional_worked_examples(self):
        self.assertEqual(allocate_region({'A':1350000,'B':935000,'C':3560000,'D':45000,'E':490000},48),
                         {'A':10,'B':7,'C':27,'D':0,'E':4})
        self.assertEqual(allocate_region({'A':780000,'B':35000,'C':1360000,'D':490000,'Independent':104500},24),
                         {'A':7,'B':0,'C':12,'D':4,'Independent':1})

    def test_regional_remainders_have_no_five_seat_cap(self):
        votes={str(i):160-10*i for i in range(12)}
        self.assertEqual(allocate_region(votes,6),{str(i):int(i<6) for i in range(12)})
        self.assertNotEqual(allocate_region(votes,6),allocate(votes,6))
        with self.assertRaises(AllocationTie):allocate_region({'A':10,'B':10},1)

    def test_change_mechanisms(self):
        v={"A":60,"B":40}
        self.assertEqual(perturb(v,"A",1,"add"),{"A":61,"B":40})
        self.assertEqual(perturb(v,"A",1,"abstain"),{"A":59,"B":40})
        self.assertEqual(perturb(v,"A",1,"switch","B"),{"A":59,"B":41})
        self.assertEqual(v,{"A":60,"B":40})

    def test_exact_strict_half_threshold(self):
        v={"ANC":10026475,"Other":7410904}
        self.assertEqual(below_half_threshold(v,"ANC","switch"),1307786)
        self.assertEqual(below_half_threshold(v,"ANC","opposition_add"),2615572)
        for action in ["switch","opposition_add","abstain"]:
            k=below_half_threshold(v,"ANC",action)
            def share(n):
                if action=="opposition_add":return v['ANC']/(sum(v.values())+n)
                return (v['ANC']-n)/(sum(v.values())-(n if action=='abstain' else 0))
            self.assertGreaterEqual(share(k-1),.5)
            self.assertLess(share(k),.5)

    def test_invalid_inputs(self):
        for v in [{},{"A":0},{"A":-1},{"A":1.5},{"A":True}]:
            with self.assertRaises(ValueError):allocate(v)
        with self.assertRaises(ValueError):perturb({"A":3},"A",4,"abstain")
        with self.assertRaises(ValueError):perturb({"A":3},"A",1,"switch","A")

    def test_tie_is_not_arbitrary(self):
        with self.assertRaises(AllocationTie):allocate({"A":10,"B":10},1)

    def test_bounded_search_is_not_an_impossibility_claim(self):
        v={"A":10026475,"B":7410904}
        r=first_change(v,"A",limit=1)
        self.assertIsNone(r['k'])
        self.assertEqual(r['status'],'not_found_within_bound')


if __name__ == '__main__':unittest.main()
