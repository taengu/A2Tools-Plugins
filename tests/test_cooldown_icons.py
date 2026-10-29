import importlib.util
from pathlib import Path
import unittest


path = Path(__file__).resolve().parents[1] / "tools" / "cooldowns" / "build_skills.py"
spec = importlib.util.spec_from_file_location("build_cooldown_skills", path)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class CooldownArtworkTests(unittest.TestCase):
    def test_regeneration_corrects_the_reported_skills(self):
        self.assertEqual(builder.skill_icon(11250000, "/Icons/ICON_GL_SKILL_024"), "ICON_GL_SKILL_040")
        self.assertEqual(builder.skill_icon(11400000, "/Icons/ICON_GL_SKILL_040"), "ICON_GL_SKILL_024")

    def test_regeneration_covers_buff_ranks_and_leaves_other_artwork_alone(self):
        for rank in range(6):
            self.assertEqual(builder.buff_icon(112500001 + rank * 100, "/Icons/ICON_GL_SKILL_024"), "ICON_GL_SKILL_040")
            self.assertEqual(builder.buff_icon(114000001 + rank * 100, "/Icons/ICON_GL_SKILL_040"), "ICON_GL_SKILL_024")
        self.assertEqual(builder.skill_icon(11300000, "/Icons/ICON_GL_SKILL_030"), "ICON_GL_SKILL_030")
        self.assertEqual(builder.buff_icon(113000001, "/Icons/ICON_GL_SKILL_030"), "ICON_GL_SKILL_030")


if __name__ == "__main__":
    unittest.main()
