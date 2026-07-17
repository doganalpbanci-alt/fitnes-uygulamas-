// free-exercise-db (MIT) seçkisinden üretildi — scratchpad/curate.mjs
import type { Exercise } from '../db';

export const SEED_EXERCISES: Exercise[] = [
  {
    id: "Barbell_Bench_Press_-_Medium_Grip",
    name: "Bench Press (Halter)",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Barbell_Incline_Bench_Press_-_Medium_Grip",
    name: "Eğimli Bench Press (Halter)",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Dumbbell_Bench_Press",
    name: "Bench Press (Dambıl)",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Incline_Dumbbell_Press",
    name: "Eğimli Dambıl Pres",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Dumbbell_Flyes",
    name: "Dambıl Fly",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Butterfly",
    name: "Pec Deck (Kelebek)",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Cable_Crossover",
    name: "Kablo Crossover",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Pushups",
    name: "Şınav",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Dips_-_Chest_Version",
    name: "Dips (Göğüs)",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Leverage_Chest_Press",
    name: "Makine Göğüs Pres",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Decline_Barbell_Bench_Press",
    name: "Alçalan Bench Press (Halter)",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Decline_Dumbbell_Bench_Press",
    name: "Alçalan Bench Press (Dambıl)",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Decline_Dumbbell_Flyes",
    name: "Alçalan Dambıl Fly",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Flat_Bench_Cable_Flyes",
    name: "Kablo Fly (Düz Bank)",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Incline_Cable_Flye",
    name: "Eğimli Kablo Fly",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Incline_Cable_Chest_Press",
    name: "Eğimli Kablo Göğüs Pres",
    muscleGroup: "gogus",
    type: "resistance"
  },
  {
    id: "Pullups",
    name: "Barfiks",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Chin-Up",
    name: "Chin-Up (Ters Barfiks)",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Wide-Grip_Lat_Pulldown",
    name: "Lat Pulldown (Geniş)",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Bent_Over_Barbell_Row",
    name: "Bent Over Row (Halter)",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "One-Arm_Dumbbell_Row",
    name: "Tek Kol Dambıl Row",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Bent_Over_Two-Dumbbell_Row",
    name: "Dambıl Row (İki Kol)",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Seated_Cable_Rows",
    name: "Oturarak Kablo Row",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Barbell_Deadlift",
    name: "Deadlift",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Romanian_Deadlift",
    name: "Romanian Deadlift",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Sumo_Deadlift",
    name: "Sumo Deadlift",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Trap_Bar_Deadlift",
    name: "Trap Bar Deadlift",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Rack_Pulls",
    name: "Rack Pull",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Face_Pull",
    name: "Face Pull",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Barbell_Shrug",
    name: "Shrug (Halter)",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Hyperextensions_Back_Extensions",
    name: "Hyperextension",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Straight-Arm_Dumbbell_Pullover",
    name: "Dambıl Pullover",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "T-Bar_Row_with_Handle",
    name: "T-Bar Row",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Close-Grip_Front_Lat_Pulldown",
    name: "Lat Pulldown (Dar)",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Underhand_Cable_Pulldowns",
    name: "Ters Kavrama Lat Pulldown",
    muscleGroup: "sirt",
    type: "resistance"
  },
  {
    id: "Barbell_Squat",
    name: "Squat (Halter)",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Leg_Press",
    name: "Leg Press",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Leg_Extensions",
    name: "Leg Extension",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Lying_Leg_Curls",
    name: "Yatarak Leg Curl",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Seated_Leg_Curl",
    name: "Oturarak Leg Curl",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Dumbbell_Lunges",
    name: "Lunge (Dambıl)",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Barbell_Hip_Thrust",
    name: "Hip Thrust",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Standing_Calf_Raises",
    name: "Ayakta Kalf",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Barbell_Seated_Calf_Raise",
    name: "Oturarak Kalf",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Goblet_Squat",
    name: "Goblet Squat",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Dumbbell_Step_Ups",
    name: "Step-Up (Dambıl)",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Front_Squat_Clean_Grip",
    name: "Front Squat",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Box_Squat",
    name: "Box Squat",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Split_Squats",
    name: "Split Squat",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Smith_Single-Leg_Split_Squat",
    name: "Tek Bacak Split Squat (Smith)",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Barbell_Side_Split_Squat",
    name: "Yan Split Squat",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Adductor",
    name: "İç Bacak (Adductor)",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Thigh_Abductor",
    name: "Dış Bacak (Abductor)",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Weighted_Sissy_Squat",
    name: "Sissy Squat",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Zercher_Squats",
    name: "Zercher Squat",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Donkey_Calf_Raises",
    name: "Donkey Kalf",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Glute_Kickback",
    name: "Glute Kickback",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "One-Legged_Cable_Kickback",
    name: "Kablo Glute Kickback (Tek Bacak)",
    muscleGroup: "bacak",
    type: "resistance"
  },
  {
    id: "Barbell_Shoulder_Press",
    name: "Omuz Pres (Halter)",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Dumbbell_Shoulder_Press",
    name: "Omuz Pres (Dambıl)",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Side_Lateral_Raise",
    name: "Lateral Raise",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Front_Dumbbell_Raise",
    name: "Öne Dambıl Kaldırma",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Reverse_Flyes",
    name: "Reverse Fly (Arka Omuz)",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Upright_Barbell_Row",
    name: "Upright Row",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Arnold_Dumbbell_Press",
    name: "Arnold Pres",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Standing_Military_Press",
    name: "Ayakta Askeri Pres",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Seated_Barbell_Military_Press",
    name: "Oturarak Askeri Pres (Halter)",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Cable_Seated_Lateral_Raise",
    name: "Kablo Lateral Raise (Oturarak)",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Cable_Rear_Delt_Fly",
    name: "Kablo Arka Omuz Fly",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Machine_Shoulder_Military_Press",
    name: "Makine Omuz Pres",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Cuban_Press",
    name: "Cuban Press",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "External_Rotation",
    name: "Dış Rotasyon (Omuz Sağlık)",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Push_Press",
    name: "Push Press",
    muscleGroup: "omuz",
    type: "resistance"
  },
  {
    id: "Barbell_Curl",
    name: "Biceps Curl (Halter)",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Dumbbell_Alternate_Bicep_Curl",
    name: "Dambıl Curl (Dönüşümlü)",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Hammer_Curls",
    name: "Hammer Curl",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Preacher_Curl",
    name: "Preacher Curl",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Concentration_Curls",
    name: "Concentration Curl",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "EZ-Bar_Skullcrusher",
    name: "Skullcrusher (EZ Bar)",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Triceps_Pushdown",
    name: "Triceps Pushdown",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Cable_Rope_Overhead_Triceps_Extension",
    name: "Overhead Triceps (Halat)",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Close-Grip_Barbell_Bench_Press",
    name: "Dar Bench Press",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Bench_Dips",
    name: "Bank Dips",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Zottman_Curl",
    name: "Zottman Curl",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Spider_Curl",
    name: "Spider Curl",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Drag_Curl",
    name: "Drag Curl",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Standing_Dumbbell_Reverse_Curl",
    name: "Ters Curl (Dambıl)",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "High_Cable_Curls",
    name: "Yüksek Kablo Curl",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Overhead_Cable_Curl",
    name: "Overhead Kablo Curl",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "JM_Press",
    name: "JM Press",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Tate_Press",
    name: "Tate Press",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Tricep_Dumbbell_Kickback",
    name: "Triceps Kickback (Dambıl)",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Incline_Barbell_Triceps_Extension",
    name: "Eğimli Triceps Extension (Halter)",
    muscleGroup: "kol",
    type: "resistance"
  },
  {
    id: "Crunches",
    name: "Mekik (Crunch)",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Plank",
    name: "Plank",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Hanging_Leg_Raise",
    name: "Asılı Bacak Kaldırma",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Russian_Twist",
    name: "Russian Twist",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Cable_Crunch",
    name: "Kablo Crunch",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Mountain_Climbers",
    name: "Mountain Climber",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Decline_Crunch",
    name: "Alçalan Crunch",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "3_4_Sit-Up",
    name: "Sit-Up",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Dead_Bug",
    name: "Dead Bug",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Superman",
    name: "Superman (Sırt/Karın)",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Standing_Cable_Wood_Chop",
    name: "Kablo Wood Chop",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Barbell_Side_Bend",
    name: "Yan Eğilme (Halter)",
    muscleGroup: "karin",
    type: "resistance"
  },
  {
    id: "Running_Treadmill",
    name: "Koşu Bandı",
    muscleGroup: "kardiyo",
    type: "cardio"
  },
  {
    id: "Walking_Treadmill",
    name: "Yürüyüş (Bant)",
    muscleGroup: "kardiyo",
    type: "cardio"
  },
  {
    id: "Bicycling_Stationary",
    name: "Kondisyon Bisikleti",
    muscleGroup: "kardiyo",
    type: "cardio"
  },
  {
    id: "Bicycling",
    name: "Bisiklet (Dış Mekan)",
    muscleGroup: "kardiyo",
    type: "cardio"
  },
  {
    id: "Rope_Jumping",
    name: "İp Atlama",
    muscleGroup: "kardiyo",
    type: "cardio"
  },
  {
    id: "Elliptical_Trainer",
    name: "Eliptik",
    muscleGroup: "kardiyo",
    type: "cardio"
  },
  {
    id: "Rowing_Stationary",
    name: "Kürek Makinesi",
    muscleGroup: "kardiyo",
    type: "cardio"
  },
  {
    id: "Stairmaster",
    name: "Merdiven (Stairmaster)",
    muscleGroup: "kardiyo",
    type: "cardio"
  },
  {
    id: "Farmers_Walk",
    name: "Farmer's Walk",
    muscleGroup: "kardiyo",
    type: "cardio"
  },
  {
    id: "Sled_Push",
    name: "Sled İtme",
    muscleGroup: "kardiyo",
    type: "cardio"
  },
  {
    id: "Front_Box_Jump",
    name: "Box Jump",
    muscleGroup: "kardiyo",
    type: "cardio"
  }
];
